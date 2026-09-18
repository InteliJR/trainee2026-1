# Arquitetura Proposta — EcoRota

Este documento registra as decisões de arquitetura e, principalmente, o **porquê** de cada uma, com base nas restrições do case (guia de integração, contrato de WebSocket e documentação do cenário).

---

## 1. Monolito com camadas (não microsserviços)

**Decisão:** uma única aplicação backend (API própria + consumidor WebSocket + broker para o browser), estruturada em camadas: rotas → serviços → repositórios.

**Por quê:**
- O case premia **demo funcionando dentro do prazo**, não escala. Microsserviços adicionam complexidade de rede, deploy e operação sem nenhum benefício aqui.
- Os 3 fluxos (morador, coletor, dashboard) compartilham o mesmo domínio e o mesmo estado operacional da EcoRota. Separar isso em serviços independentes obrigaria a sincronizar estado entre eles — mais trabalho, mais ponto de falha.
- O time é de trainee: monolito bem organizado é mais fácil de entender, debugar e fazer onboarding de novos membros.
- Camadas (rotas → serviços → repositórios) já garantem a testabilidade e o isolamento de responsabilidades, que é o que realmente se ganha com arquitetura limpa — sem o custo operacional.

---

## 2. Node.js + TypeScript (full stack, monorepo)

**Decisão:** backend e frontend em TypeScript, em um monorepo com `apps/api`, `apps/web` e `packages/shared`.

**Por quê:**
- **A documentação oficial da EcoRota já traz o consumidor de WebSocket em Node.js** (pacote `ws`). Usar Node elimina o atrito de traduzir esse código para outra linguagem e permite reutilizar o exemplo quase como está.
- TypeScript dá **tipos compartilhados** entre API e frontend (`packages/shared`): o schema de envios de eventos da EcoRota, os status de solicitação e a tradução técnico→amigável ficam definidos uma vez só. Erros de contrato são pegos em tempo de compilação.
- Mesma linguagem para os dois lados reduz a curva de aprendizado do time e permite que qualquer membro contribua nos dois lados.
- Ecossistema rico de ferramentas (Prisma, Fastify, Vite, Socket.IO) e facilidade de deploy.

---

## 3. Credencial sempre no backend + padrão proxy

**Decisão:** o frontend **nunca** chama a EcoRota diretamente. Toda chamada passa pela API do time, que carrega o token e repassa.

**Por quê:**
- O guia de integração é explícito: a credencial não deve aparecer nas telas, no código do navegador nem em repositórios públicos. É um requisito do case.
- A API própria também é o ponto único para: **autenticar nossos usuários** (morador/coletor), **mapear solicitações** via `externalReference` e **evitar duplicação** de pedidos — coisas que a EcoRota não modela.
- Com um único gateway, contabilizar e respeitar o limite de **300 chamadas/min por ambiente** fica centralizado (cache, polling único, controle de erros 429).

---

## 4. Backend: Fastify (ou Express) em Node

**Decisão:** Fastify para a API REST própria; `ws` para o consumidor da EcoRota.

**Por quê:**
- Fastify é rápido, tem ótimo suporte a TypeScript e schema (validação) de primeira classe com quase zero configuração.
- Como a API faz proxy para a EcoRota, a validação de entrada/saída no próprio serviço evita que contratos errados se propaguem.
- Express é alternativa válida se o time preferir; a escolha em si é de conforto — o essencial é a separação em camadas, não o framework.

---

## 5. Banco de dados: PostgreSQL + Prisma (SQLite como atalho)

**Decisão:** PostgreSQL com Prisma ORM; SQLite permitido para começar, migrando depois.

**Por quê:**
- Precisamos de **modelagem própria**: usuários, papéis, mapeamento `externalReference ↔ id EcoRota`, gamificação. Isso não existe na API da EcoRota — é responsabilidade do time.
- Prisma dá migrations versionadas e tipos gerados a partir do schema, alinhado com o time em TypeScript.
- PostgreSQL é o padrão real de produção e tem bom suporte em qualquer PaaS (Railway/Render); SQLite permite esvaziar a demanda de infra nas primeiras semanas, com um caminho de migração simples.

---

## 6. Autenticação: JWT em cookie httpOnly, papéis MORADOR e COLETOR

**Decisão:** login próprio, sessão via JWT assinado e guardado em cookie httpOnly (`SameSite`), com papéis separados.

**Por quê:**
- A EcoRota não fornece login de usuários finais — o guia diz que é "modelagem própria de vocês".
- Morador e coletor têm até **interfaces e lógicas diferentes** (o coletor confirma coleta, o morador solicita). Papéis distintos permitem autorização granular no backend (RBAC) sem duplicar lógica no frontend.
- Cookie httpOnly protege o token de XSS (o JavaScript do browser não consegue lê-lo) e, por rodarmos frontend e API no mesmo domínio, o cookie viaja automaticamente — sem CORS e sem guardar token no `localStorage`.

---

## 7. Tempo real: consumidor WS no backend + repasse via Socket.IO ao browser

**Decisão:** o backend mantém uma conexão `wss://…/v1/stream` com a EcoRota e repassa o estado operacional aos navegadores autorizados via Socket.IO. Polling HTTP de 5 s como fallback.

**Por quê:**
- O dashboard operacional precisa de **posições de coletores em tempo real** para impressionar na demo ("mostra a operação acontecendo").
- O guia proíbe conectar o WebSocket a partir do navegador e limita a **5 conexões simultâneas** por ambiente. Se cada browser conectasse, 5 abas derrubariam o limite. Com um **único consumidor no backend**, uma conexão serve todos os navegadores — e a credencial nunca sai do servidor.
- O contrato de eventos (snapshot + envelopes com `id`/`revision`/`generation`) é feito para ser mantido como **cache substituível integralmente**. O backend aplica snapshot, deduplica por `id`, descarta `revision` menor que a última, e repassa apenas o delta aos clientes.
- **Reconexão com backoff exponencial + randomização** é exigida pela doc — centrá-la num único processo evita N browsers tentando reconectar ao mesmo tempo.
- `observedAt` é comparado para **sinalizar telemetria desatualizada** (posição "congelada" no mapa), requisito explícito do guia.
- Fallback de polling 5 s: 12 req/min ≈ **4% do limite** de 300/min, e é o caminho mais simples para começar e para recuperar estado se o WS cair.

---

## 8. Interface `EcoRotaClient` (adapter isolado)

**Decisão:** toda comunicação com a EcoRota (HTTP e WS) fica atrás de uma interface `EcoRotaClient`, com o protocolo de eventos isolado em um módulo próprio.

**Por quê:**
- O contrato é **externo e fora do nosso controle**. Isolar o adapter permite testar o resto da aplicação com um `FakeEcoRotaClient` (sem tocar na API real e sem gastar cota), e trocar transporte sem reescrever regras de negócio.
- Separa responsabilidade: o módulo de integração cuida de reconexão, dedup, cache e `generation` — as outras camadas nem sabem disso.
- Se a EJ reiniciar o cenário, é nesse módulo (e no `SystemState` do banco) que se faz a recuperação de `generation`/`revision`, sem propagar efeito nas telas.

---

## 9. Modelagem própria do banco

**Decisão:** `User` (papel/credencial), `CollectorProfile` (id EcoRota + disponibilidade), `Request` (externalReference ↔ id EcoRota + cache de status), `PointsLog`/`Badge`/`Goal` (gamificação), `SystemState` (última revision).

**Por quê:**
- **`User`** — login não existe na API externa; é nossa obrigação.
- **`CollectorProfile`** — coletores `custom` são cadastrados pelo time e o time controla disponibilidade (`available`/`unavailable`). Precisamos relacionar nosso usuário coletor ao id da EcoRota. A regra "para excluir, ele deve estar indisponível e sem trabalho atribuído" fica checável na nossa camada.
- **`Request`** — a doc permite colagem de pedidos: **reenviar a mesma `externalReference` para o mesmo ponto recupera o pedido existente, sem duplicar**. Guardar o mapeamento garante idempotência e um histórico filtrado por usuário.
- **Gamificação** (`PointsLog`/`Badge`/`Goal`) — é o diferencial de produto proposto no benchmark (streak, meta do mês, confete, mascote). Nada disso vem da EcoRota; precisa de tabelas próprias.
- **`SystemState`** — se a EJ resetar o cenário, `generation`/`revision` permitem detectar o reset e recarregar, sem reenviar pedidos antigos automaticamente (requisito do guia).

---

## 10. Frontend único responsivo/PWA (web, não nativo)

**Decisão:** uma única app React + Vite + Tailwind, responsiva e instalável (PWA), com rotas `/morador`, `/coletor` e `/dashboard`. Mapa com MapLibre.

**Por quê:**
- Um só codebase atende celular (morador/coletor) e desktop (dashboard). **App nativo (React Native) dobraria o trabalho de frontend no prazo** sem vantagem decisiva para a demo.
- O público do coletor usa o app em campo → tela de celular com **botões grandes** (insight da `docs_mafe`) e familiaridade visual com apps de entrega/WhatsApp. Isso se resolve com responsividade e design, não com runtime nativo.
- PWA permite "instalar" sem passar por loja — importante para testar nos próprios celulares durante o desenvolvimento.
- MapLibre é leve, open source e renderiza os pontos/posições (GeoJSON `Point`) sem custo nem token (diferente de alternativas comerciais).

---

## 11. Dashboard: mesma base, ordem de prioridade clara

**Decisão:** o dashboard prioriza, nesta ordem: (1) KPIs no topo → (2) mapa operacional em tempo real → (3) lista de solicitações recentes → (4) demanda×oferta e linha do tempo.

**Por quê:**
- Reflete risco/prazo: KPIs são rápidos e de alto impacto visual; o mapa é o que "vende" a demo; a lista ajuda a debugar; os dois últimos são melhoria (decisão já registrada na `docs_mafe`).
- A arquitetura não muda conforme a ordem — apenas o que se polia — então isso é um plano de entrega, não uma decisão técnica isolada.

---

## 12. Deploy único (Railway/Render), mesmo domínio, Docker opcional

**Decisão:** um serviço só servindo a API e o bundle do frontend; Docker apenas se o time já dominar.

**Por quê:**
- Múltiplos serviços/deploys são complexidade que não rende nada aqui (ver item 1).
- **Mesmo domínio** elimina problemas de CORS e simplifica o JWT em cookie para toda a app.
- Docker ajuda a reproduzir o ambiente da EcoRota localmente, mas é opcional — o foco é demo.

---

## Resumo das forças do case que moldam tudo

| Restrição do case | Resposta arquitetural |
|---|---|
| Credencial não pode ir ao browser | Proxy: toda chamada via API do time |
| 5 conexões WS / 300 req/min por ambiente | Um único consumidor WS no backend + cache + fallback polling 5 s |
| WebSocket obriga "conectar do backend" | Consumidor `ws` em Node rodando na API |
| Eventos com snapshot/revision/generation | Módulo de integração isolado com dedup e cache substituível |
| Login, histórico, gamificação não existem na EcoRota | Modelagem própria no banco (User, Request, badges, etc.) |
| `externalReference` garante não-duplicação | Tabela `Request` com mapeamento idempotente |
| reset do cenário pela EJ | `SystemState` com última `generation`/`revision` |
| Prazo/demo | Monolito em camadas, deploy único, priorização do dashboard |