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

**Decisão:** `User` (papel/credencial), `Address` (endereço do morador), `CollectorProfile` (id EcoRota + disponibilidade), `Request` (externalReference ↔ id EcoRota + cache de status), `PointsLog`/`Badge`/`Goal` (gamificação), `SystemState` (última revision). A gamificação (pontos/badges/streak) é **virtual** — nada de recompensa em dinheiro real no escopo atual.

**Por quê:**
- **`User`** — login não existe na API externa; é nossa obrigação (RF01/RF02).
- **`Address`** — a EcoRota não modela endereço de morador; é exclusivamente nosso (RF03). É o endereço que define o "bairro/região" usado na demanda×oferta do dashboard (RF18.2).
- **`CollectorProfile`** — coletores `custom` são cadastrados pelo time e o time controla disponibilidade (`available`/`unavailable`). Precisamos relacionar nosso usuário coletor ao id da EcoRota. A regra "para excluir, ele deve estar indisponível e sem trabalho atribuído" fica checável na nossa camada.
- **`Request`** — a doc permite colagem de pedidos: **reenviar a mesma `externalReference` para o mesmo ponto recupera o pedido existente, sem duplicar**. Guardar o mapeamento garante idempotência e um histórico filtrado por usuário.
- **Gamificação** (`PointsLog`/`Badge`/`Goal`) — é o diferencial de produto proposto no benchmark (streak, meta do mês, confete, mascote). Nada disso vem da EcoRota; precisa de tabelas próprias.
- **`SystemState`** — se a EJ resetar o cenário, `generation`/`revision` permitem detectar o reset e recarregar, sem reenviar pedidos antigos automaticamente (requisito do guia).

---

## 10. Fluxo de telas atravessando a arquitetura

As telas definidas na `docs_mafe` (e os requisitos RF/RN/RNF derivados delas) mapeiam 1:1 nos componentes desta arquitetura. Toda tela percorre o mesmo caminho padrão — **nunca** pular a camada de serviço e **nunca** tocar a EcoRota diretamente:

```
Tela (React) → rota da nossa API (Fastify) → serviço de domínio → repositório/banco → EcoRotaClient → EcoRota
                                                      ↓
                                        (evento request.completed) → gamificação (PointsLog/Badge)
```

### 10.1 Área do morador (`/morador`)

**Cadastro/Login (RF01, RF02)** — tela → `POST /auth/register` · `POST /auth/login` (API própria) → `AuthService` grava/valida `User` (nome, e-mail, senha hash) → JWT em cookie httpOnly com role `MORADOR`. A EcoRota não participa: login é modelagem própria. O RBAC (RNF05) já decide para qual área redirecionar.

**Endereço (RF03)** — tela → `PUT /me/address` → tabela `Address` (bairro/região + texto da coordenada). É o endereço que alimenta a demanda×oferta por região do dashboard (RF18.2) e a regra de não-duplicidade RN08.

**Descoberta de pontos/coletores (RF07)** — tela (mapa MapLibre ou lista) → `GET /points` (API própria) → **responde do cache operacional** (`OperationState` mantido pelo consumidor WS), em GeoJSON. Ler de cache = a mesma consulta serve N moradores, sem gastar a cota de 300 req/min por cada usuário. "Indicação de demanda" por ponto vem da agregação dos `Request`.

**Solicitar coleta (RF04, RF05, RN08)** — tela → `POST /requests` (ponto, material, data) → `RequestService`: valida RN08 (não haver solicitação aberta para o mesmo endereço na mesma data) → gera `externalReference` único (`pedido-<uuid>`) → grava `Request` pendente → `EcoRotaClient.createRequest` chama `POST /v1/requests` → persiste o id da EcoRota + status. Se for agendamento, o pedido é enviado à EcoRota no horário previsto (regra do guia), não na tela.

**Acompanhar status (RF06, RF15, RN09)** — atualização por **via dupla**:
- ativa: Socket.IO (room do morador) repassa eventos `request.*` vindos do consumidor WS do backend;
- passiva: polling `GET /requests` a cada 5 s como fallback/recuperação de estado.
A tradução técnico→amigável (`pending` → "aguardando coletor", `in_service` → "coletor a caminho") vive em `packages/shared` — definida uma vez, usada por todas as telas. Cancelamento: `POST /requests/{id}/cancel` com **confirmação dupla** (RN01) e janela mínima de 2 h antes do agendado (RN02).

**Histórico + engajamento (RF12, RF13, RF16, RF17, RN03)** — `GET /me/requests` + `GET /me/rewards` → `Request`, `PointsLog`, `Badge`, `Goal`. Pontos são creditados **somente pelo listener de `request.completed` no backend** — nunca por chamada da tela — garantindo RN03 (nada de recompensa antes da coleta confirmada). É gamificação virtual (streak, meta do mês, confete, mascote); sem dinheiro real no escopo atual.

### 10.2 Área do coletor (`/coletor`)

**Login (RF02)** — mesmo `AuthService`, role `COLETOR` vinculada ao `CollectorProfile` (que guarda o id da EcoRota do coletor `custom`). RNF08: a interface do coletor usa textos curtos, ícones, alto contraste e botões grandes — é decisão de frontend, sem impacto na arquitetura.

**Painel do dia (RF08, RN05)** — tela → `GET /collector/requests` → `RequestService` filtra as coletas cujo `CollectorProfile.ecoRotaId` é o logado. Disponibilidade: `POST /collector/availability` → atualiza `CollectorProfile` → `EcoRotaClient.updateCollector({available})` — indisponível para de receber trabalho na EcoRota (RN05).

**Detalhe da coleta (RF09)** — `GET /collector/requests/:id` → ponto (da `OperationState`) + material esperado. Confirmação: `POST /collector/requests/:id/complete` → serviço valida que o coletor é `custom` **e** o status é `in_service` (regra do guia) → `EcoRotaClient.completeRequest`. Cancelar: `POST /collector/requests/:id/cancel`.

**Morador ausente (RN06)** — variante do cancelamento que exige registro do motivo e oferece reagendamento (cancela + cria nova solicitação com nova `externalReference`).

### 10.3 Dashboard operacional (`/dashboard`)

Tudo alimentado pelo **estado operacional do backend** — nenhuma requisição de dashboard vira chamada direta à EcoRota:

1. **KPIs (RF18.1, RF18.3)** — `GET /dashboard/stats`: agregados pré-computados sobre o cache (coletas ativas, concluídas dia/semana, taxa de cancelamento, coletores disponíveis vs total). Pré-computados = dashboard em < 3 s (RNF03).
2. **Mapa em tempo real (RF18.2)** — pipeline:
   ```
   EcoRota WS → EcoRotaClient (snapshot+eventos, dedup) → OperationState → Socket.IO → telas autorizadas
   ```
   O evento `collector.position_updated` chega ao browser; posição com `observedAt` antigo é marcada como congelada no mapa — nunca esconder telemetria velha.
3. **Solicitações recentes** — `GET /dashboard/requests` (leitura do cache; útil para debug e demo).
4. **Demanda×oferta e linha do tempo** — agregação do cache por região (RF18.2) + histórico persistido de `request.completed` para a timeline/prova de tração (RF18.3).

**Resultado:** entre as áreas muda apenas rota e autorização (RNF05); o fluxo por baixo é o mesmo caminho de camadas — eliminando o risco de "atalhos" (ex.: chamar a EcoRota direto do front), que quebrariam a cota e a segurança.

---

## 11. Frontend único responsivo/PWA (web, não nativo)

**Decisão:** uma única app React + Vite + Tailwind, responsiva e instalável (PWA), com rotas `/morador`, `/coletor` e `/dashboard`. Mapa com MapLibre.

**Por quê:**
- Um só codebase atende celular (morador/coletor) e desktop (dashboard). **App nativo (React Native) dobraria o trabalho de frontend no prazo** sem vantagem decisiva para a demo.
- O público do coletor usa o app em campo → tela de celular com **botões grandes** (insight da `docs_mafe`) e familiaridade visual com apps de entrega/WhatsApp. Isso se resolve com responsividade e design, não com runtime nativo.
- PWA permite "instalar" sem passar por loja — importante para testar nos próprios celulares durante o desenvolvimento.
- MapLibre é leve, open source e renderiza os pontos/posições (GeoJSON `Point`) sem custo nem token (diferente de alternativas comerciais).

---

## 12. Dashboard: mesma base, ordem de prioridade clara

**Decisão:** o dashboard prioriza, nesta ordem: (1) KPIs no topo → (2) mapa operacional em tempo real → (3) lista de solicitações recentes → (4) demanda×oferta e linha do tempo.

**Por quê:**
- Reflete risco/prazo: KPIs são rápidos e de alto impacto visual; o mapa é o que "vende" a demo; a lista ajuda a debugar; os dois últimos são melhoria (decisão já registrada na `docs_mafe`).
- A arquitetura não muda conforme a ordem — apenas o que se polia — então isso é um plano de entrega, não uma decisão técnica isolada.

---

## 13. Deploy único (Railway/Render), mesmo domínio, Docker opcional

**Decisão:** um serviço só servindo a API e o bundle do frontend; Docker apenas se o time já dominar.

**Por quê:**
- Múltiplos serviços/deploys são complexidade que não rende nada aqui (ver item 1).
- **Mesmo domínio** elimina problemas de CORS e simplifica o JWT em cookie para toda a app.
- Docker ajuda a reproduzir o ambiente da EcoRota localmente, mas é opcional — o foco é demo.

---

## 14. Matriz de Escolhas Técnicas da Stack (Por que cada tecnologia?)

| Camada / Ferramenta | Escolha Técnica | Justificativa & Por Quê da Escolha |
|---|---|---|
| **Gerenciamento do Repo** | Monorepo com `pnpm` Workspaces | Permite compartilhar o pacote `@ecorota/shared` (tipos da EcoRota, enums e tradução de status) entre API e Web sem duplicação. O `pnpm` é mais rápido e usa menos espaço em disco que o `npm`. |
| **Linguagem (Full Stack)** | TypeScript | Garante tipagem estática ponta a ponta. Erros de envio no contrato com a EcoRota são capturados em tempo de compilação, eliminando bugs de execução na demo. |
| **Backend Framework** | Fastify em Node.js | A doc da EcoRota fornece o código de referência em Node.js (`ws`). O Fastify é até 2x mais rápido que o Express, possui validação de schemas embutida e excelente integração com TS. |
| **Banco de Dados & ORM** | PostgreSQL + Prisma ORM | A EcoRota **não possui banco de dados próprio para nossos usuários** (sem login, e-mails, endereços, histórica por morador ou gamificação). O Postgres armazena esses dados próprios com consistência relacional e o Prisma oferece migrations versionadas para o time. |
| **Frontend Framework** | React + Vite | O Vite proporciona reinicialização e compilação instantânea (HMR), essencial para acelerar o desenvolvimento no prazo emergencial de 1,5 semana. O React facilita a divisão dos 3 fluxos (`/morador`, `/coletor`, `/dashboard`) em componentes isolados. |
| **Estilização** | Tailwind CSS | Agiliza a criação de layouts responsivos (PWA) e permite criar a interface acessível do coletor (botões grandes, ícones e alto contraste) exigida no requisito RNF08 sem perder tempo escrevendo CSS do zero. |
| **Biblioteca de Mapas** | MapLibre GL JS | Open-source e 100% gratuita (sem necessidade de cadastrar cartão de crédito ou chaves pagas como Mapbox/Google Maps). Renderiza pontos e posições em formato GeoJSON `Point [lng, lat]` nativamente. |
| **Tempo Real (API ➔ Web)** | Socket.IO | O case restringe a 5 conexões WebSocket simultâneas com a EcoRota. O backend estabelece 1 conexão WS com a EcoRota, guarda no cache `OperationState` e o Socket.IO retransmite para N moradores e dashboards conectados sem estourar o limite. |
| **Autenticação & Sessão** | JWT em Cookies `httpOnly` | Armazena o token de sessão com proteção contra ataques XSS (o JS do browser não lê o cookie). Por estar no mesmo domínio, o cookie viaja automaticamente sem complicar com CORS. |

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
| Caso: login, endereço e gamificação são nossos | Tabelas próprias `User`, `Address`, `PointsLog`/`Badge`/`Goal` |
| Sincronizar status em tempo (quase) real (RF15/RN09) | Socket.IO (eventos WS) + polling de 5 s de fallback |
| Dashboard sem queimar a cota (RNF03) | Leitura do cache `OperationState` + agregados pré-computados |
| Pontos só após coleta concluída (RN03) | Listener de `request.completed` no backend credita recompensa |
| Prazo/demo | Monolito em camadas, deploy único, priorização do dashboard |