# EcoRota — trainee 2026.1

MVP de logística reversa: o morador solicita a coleta de material reciclável num ponto de coleta, um coletor é atribuído e confirma a retirada, e um painel operacional acompanha tudo em tempo real. As coletas dos pontos da EcoRota (API externa do case) são atribuídas pela própria EcoRota; as dos pontos cadastrados pelo operador na plataforma são atribuídas pelo operador no painel.

- Consulte [`documents/GUIA-ARQUIVOS.md`](documents/GUIA-ARQUIVOS.md) para entender cada arquivo e o fluxo completo.
- Consulte [`documents/wad.md`](documents/wad.md) para a modelagem de dados, o contrato de endpoints e os requisitos detalhados.
- Consulte [`documents/PLANO.md`](documents/PLANO.md) para o planejamento da equipe.

## Arquitetura e tecnologias

Monólito em camadas (rotas → serviços → repositórios), não microsserviços: o time é pequeno e o prazo é curto, e os três fluxos (morador, coletor, operador) compartilham o mesmo domínio e o mesmo estado operacional.

- **Monorepo `pnpm`**: `apps/api` (backend), `apps/web` (frontend), `packages/shared` (tipos e traduções usados pelos dois lados, como o vocabulário de status de uma coleta).
- **Backend — Fastify + TypeScript**, com **Prisma** sobre **PostgreSQL** (hospedado no Supabase). O frontend nunca fala com a EcoRota diretamente: toda chamada passa pela API própria, atrás da interface `EcoRotaClient`, que isola o contrato externo (HTTP e WebSocket) do resto da aplicação.
- **Autenticação própria**: a EcoRota não modela login. A API cria a sessão com JWT assinado, guardado em cookie `httpOnly`, com o papel do usuário (`MORADOR`, `COLETOR` ou `OPERADOR`).
  - **Um cookie por papel** (`ecorota_sessao_morador`, `_coletor`, `_operador`): cada área do frontend informa o seu papel no cabeçalho `X-EcoRota-Papel` (e no handshake do Socket.IO), e a API lê o cookie desse papel. Assim, morador, coletor e operador ficam logados ao mesmo tempo no mesmo navegador.
  - O login feito numa área recusa (403) contas de outro papel **antes** de criar o cookie, para não derrubar a sessão desse papel aberta em outra aba. O "Sair" apaga só o cookie da área.
- **Tempo real**: o backend mantém a única conexão WebSocket com a EcoRota (o guia de integração limita o número de conexões simultâneas) e retransmite o estado por Socket.IO às telas autorizadas, filtrado por sala (`usuario:<id>`, `papel:<papel>`).
  - Posições dos coletores **da EcoRota**: operador vê todas; o morador só a do coletor que atende uma coleta dele.
  - Posições dos coletores **da plataforma** (enviadas pelo app do coletor): só o painel do operador, pelo evento `coletor-local:posicao`.
- **Frontend — React + Vite + Tailwind**, PWA responsiva (mobile para morador/coletor, mais confortável em telas largas para o operador). Mapas com **MapLibre** (leve, sem chave paga): painel operacional, escolha do ponto na solicitação do morador e rota do coletor.

## Pré-requisitos

- Node.js 20+ e `pnpm` (via `corepack enable`, ou instalado globalmente)
- Um banco PostgreSQL: **Docker** (`docker-compose.yml` sobe um Postgres local) **ou** um projeto Supabase
- Opcional: uma credencial (`ECOROTA_URL`/`ECOROTA_KEY`) da API EcoRota do case. Sem ela, a integração com a EcoRota fica **desligada**: não há pontos, coletores nem mapa da EcoRota, mas o restante (contas, pontos da plataforma, solicitações e atribuição pelo operador) funciona.

## Passo a passo para rodar

```bash
# 1. instala as dependências do monorepo
pnpm install

# 2. copia o template de ambiente e preenche os valores (veja a tabela abaixo)
cp .env.example .env

# 3. banco: escolha uma das duas opções
#    a) Postgres local via Docker
docker compose up -d
#       aponte DATABASE_URL e DIRECT_URL do .env para localhost:5432 (usuário/senha/banco "ecorota")
#    b) Supabase: cole a connection string do projeto em DATABASE_URL (pooler) e DIRECT_URL (conexão direta)

# 4. gera o client do Prisma e aplica as migrations
pnpm --filter @ecorota/api prisma:generate
pnpm --filter @ecorota/api prisma:migrate:dev
#    num banco compartilhado (ex.: o Supabase do time), prefira aplicar só o que falta, sem resetar:
#    pnpm --filter @ecorota/api prisma:migrate:deploy

# 5. cria as três contas de desenvolvimento (morador, coletor, operador)
pnpm --filter @ecorota/api database:seed:development

# 6. sobe API (porta 3000) e frontend (porta 5173) juntos
pnpm dev
```

Acesse `http://localhost:5173`. A rota inicial (`/`) deixa escolher entre morador, coletor ou operador; cada uma leva ao login da própria área.

### Testando pelo celular

- O servidor de desenvolvimento escuta na rede local. Com o celular no mesmo Wi-Fi, abra `http://<IP-do-computador>:5173`.
- Em desenvolvimento, o frontend chama a API e o Socket.IO pela **mesma origem da página** (proxy do Vite para `127.0.0.1:3000`), então funciona pelo IP sem mudar o `.env`.
- O navegador só libera o **GPS** em `localhost` ou HTTPS. Pelo IP sem HTTPS, a rota do coletor mostra o destino e o botão de navegação, mas não a posição dele. Em produção (HTTPS) isso não acontece.

## Variáveis de ambiente

Definidas em `.env.example`, sem valores reais. Nunca commitar o `.env` preenchido.

| Variável | Para quê |
|---|---|
| `ECOROTA_URL` | URL base da API EcoRota do case. Opcional: sem ela (e sem `ECOROTA_KEY`), a integração com a EcoRota fica desligada. |
| `ECOROTA_KEY` | Credencial Bearer da EcoRota. Fica só no backend; o frontend nunca a recebe. |
| `PORT` | Porta da API (padrão 3000). |
| `WEB_ORIGIN` | Origem autorizada pelo CORS e pelo Socket.IO (ex.: `http://localhost:5173`). |
| `VITE_API_URL` | URL da API usada pelo frontend **em produção**. Lida em tempo de build pelo Vite (variáveis `VITE_` são públicas). Em desenvolvimento o frontend usa o proxy do Vite e ignora esta variável. |
| `DATABASE_URL` | Conexão PostgreSQL usada em tempo de execução (local ou pooler do Supabase). |
| `DIRECT_URL` | Conexão direta usada pelo Prisma CLI para gerar/aplicar migrations. |
| `JWT_SECRET` | Segredo que assina as sessões. Precisa ter **32 caracteres ou mais**; a API recusa subir sem isso. |
| `DEVELOPMENT_SEED_PASSWORD` | Senha aplicada às três contas de desenvolvimento pelo script de seed. Se não definida, usa uma senha padrão fixa no próprio script. |

## Contas de desenvolvimento

Criadas por `apps/api/scripts/seed-development.ts` (passo 5 acima), com IDs fixos para os scripts de verificação:

| Papel | E-mail |
|---|---|
| Morador | `morador.dev@ecorota.local` |
| Coletor | `coletor.dev@ecorota.local` |
| Operador | `operador.dev@ecorota.local` |

Senha: o valor de `DEVELOPMENT_SEED_PASSWORD`, ou a senha padrão definida no próprio script se a variável não estiver preenchida. O operador também cria contas de morador e coletor pela tela de perfis (`/dashboard/perfis`), e o morador pode criar a própria conta em `/morador/cadastro`.

## Fluxos principais

| Perfil | O que faz | Onde |
|---|---|---|
| Morador | Escolhe material (com quantidade aproximada em kg, opcional), ponto de coleta no mapa, data e turno; acompanha o status e vê o histórico de impacto e pontos | `/morador`, `/morador/solicitar`, `/morador/acompanhar`, `/morador/historico` |
| Operador | Acompanha a operação ao vivo (mapa, KPIs, demanda por região, solicitações recentes), gerencia pontos da plataforma e perfis, e **atribui coletores** às solicitações dos pontos da plataforma | `/dashboard`, `/dashboard/pontos`, `/dashboard/perfis`, `/dashboard/atribuicoes` |
| Coletor | Vê as coletas do dia, a **rota até o ponto** (mapa com destino e posição pelo GPS, botão para navegar no Google Maps), inicia e conclui a coleta, marca a disponibilidade | `/coletor`, `/coletor/coletas/:id`, `/coletor/disponibilidade` |

Ciclo de uma coleta num ponto da plataforma: morador solicita → operador atribui um coletor disponível em `/dashboard/atribuicoes` → coletor inicia e conclui → morador e coletor recebem 100 pontos cada.

### Rotas da API acrescentadas nesta fase

| Rota | Papel | Para quê |
|---|---|---|
| `POST /api/v1/operacao/solicitacoes-coleta/:id/atribuicao` | Operador | Atribui um coletor disponível a uma solicitação de ponto da plataforma. Recusa (409) solicitações gerenciadas pela EcoRota. O caminho antigo `/desenvolvimento/...` continua para scripts. |
| `POST /api/v1/coletor/posicao` | Coletor | Recebe a posição do GPS durante a coleta; fica em memória (expira em 5 min) e vai ao painel do operador. |
| `GET /api/v1/pontuacao/regras` | Morador, coletor | Informa quantos pontos cada coleta concluída rende (hoje, 100), para a tela não repetir a regra no código. |
| `POST /api/v1/solicitacoes-coleta/:id/conclusao` | Coletor | `fotoUrl` passou a ser **opcional**. |

Cada solicitação também passou a trazer `coletor.telefone`, `pontosPrevistos` e `previsaoChegada` (esta só quando a EcoRota calcula a rota; veja as limitações).

## Testando os três perfis

- Abra `http://localhost:5173/` e escolha um perfil; cada área (`/morador`, `/coletor`, `/operador` → `/dashboard`) tem login próprio e recusa contas de outro papel.
- **Morador, coletor e operador podem ficar logados ao mesmo tempo no mesmo navegador** (um cookie por papel). Duas contas do **mesmo** papel ainda se substituem; para isso, use uma janela anônima.
- Não há dados de exemplo: todas as telas usam a API real. Sem conexão, elas mostram o erro em vez de dados falsos.

## Coerência entre perfis (RNF)

- **Login unificado:** morador, coletor e operador usam o mesmo componente `RoleLoginPage`, diferenciados apenas por `eyebrow`, `title`, `description` e `icon`; o guarda de rota `RequireRole` é o mesmo nas três áreas.
- **Navegação por papel:** morador tem navegação inferior (Início, Solicitar, Acompanhar, Histórico, Perfil e Sair); coletor tem 3 abas (Hoje, Disponível, Perfil); operador navega pelo cabeçalho do painel (Operação, Pontos, Perfis, Atribuições).
- **Status traduzidos:** todos os perfis usam `translateStatus` de `packages/shared` para converter códigos técnicos (`pending`, `assigned`, etc.) em rótulos amigáveis ("Aguardando coletor", "Coletor a caminho").
- **Padrão de erros:** mensagens de API seguem o formato `{ codigo, mensagem, detalhes }`; o frontend exibe `mensagem` em português com instrução de ação quando aplicável.
- **Tokens visuais:** as cores e sombras vêm de `apps/web/src/styles/design-tokens.ts` (guia de estilos): `operational` para dashboard/operador, `brand` para morador, `danger` para cancelamentos/arquivamentos.

## Limitações e hipóteses assumidas

- **Solicitações em pontos da plataforma não vão para a EcoRota.** Só as dos pontos EcoRota são sincronizadas e atribuídas pela EcoRota. As dos pontos cadastrados pelo operador ficam na plataforma e dependem da atribuição manual em `/dashboard/atribuicoes`; por isso não têm rota calculada nem **previsão de chegada** (a tela mostra "Sem previsão").
- **Coletores da EcoRota não têm telefone.** O telefone do coletor aparece para o morador só quando o coletor é um usuário da plataforma com telefone cadastrado.
- **Rota do coletor em linha reta.** O mapa liga a posição do coletor ao destino por uma linha reta; o traçado pelas ruas fica com o Google Maps, aberto só quando o coletor toca no botão. A posição vai só para a API da plataforma, nunca a serviços externos.
- **Posição do coletor da plataforma só em memória e só para o operador.** Enviada enquanto a tela da rota está aberta (a cada 15 s ou 25 m), expira em 5 minutos e não é persistida. A tela do morador não mostra o coletor ao vivo (decisão do time), então a posição não é enviada a ele.
- **Sem foto na conclusão.** Decisão de produto: o app não captura foto; a API aceita concluir sem `fotoUrl`.
- **Peso reciclado depende da quantidade informada.** O histórico soma só as coletas em que o morador informou a quantidade em kg; nas demais, o peso fica de fora (sem estimativa por material).
- **Meta do mês fixa em 5 coletas** no histórico do morador; não há meta na API.
- **Prazo mínimo de cancelamento: usa 1 dia, fixo no código.** `request.service.ts` tem `ONE_DAY_MS` como constante (não lê de variável de ambiente). O documento de arquitetura antigo (`documents/Luiz/arquitetura-Luiz.md`) registra 2 horas; os requisitos (`docs_mafe`, RN02) registram 1 dia. O código já decidiu por 1 dia, mas isso não foi formalmente confirmado como regra de produto.
- **Sem modo demonstração.** Os dados mockados foram removidos; com a API fora do ar, as telas abrem e mostram o erro de conexão. A única exceção é a fila offline do coletor (abaixo).
- **Fila offline do coletor (RNF02):** após um login e carregamento online, as ações de iniciar e concluir coleta ficam no `localStorage` por coletor quando a rede cai. A área do coletor tenta sincronizar ao abrir, reconectar e voltar à aba. Se a API responder que a coleta já está no estado desejado (ex.: o início já saiu pela fila), a ação conta como feita; outros conflitos pausam a fila e podem ser descartados na interface. O PWA guarda a interface para abrir offline após uma primeira visita online; dados da API não são guardados pelo service worker.
- **Coletor não registra problema.** A API só permite cancelamento pelo morador ou pelo operador; o coletor não tem ação de cancelar nem de registrar "morador ausente" ou "não deu para coletar".
- **Mapa da EcoRota é fictício.** Os 12 pontos formam uma grade de uns 150 m × 100 m e os coletores andam em "L" sobre ela, sem seguir ruas; o guia de integração da EcoRota diz que os trajetos não representam navegação em ruas reais.
- **Simulação local ainda na API.** A simulação de coletor entre dois pontos foi retirada do painel, mas a rota `/operacao/simulacao-local` continua na API sem uso.

## Deploy

- **Cookie entre domínios:** o cookie de sessão usa `SameSite=Lax`. Se front e API ficarem em domínios diferentes, o navegador não o envia nas chamadas da API e o login falha em produção. Sirva os dois no mesmo domínio (ex.: API atrás de um proxy `/api` no mesmo host) ou mude o cookie para `SameSite=None; Secure`.
- **`VITE_API_URL` antes do build** do frontend (é lida no build), e `WEB_ORIGIN` com a URL do frontend em produção.
- **API sempre ligada:** ela mantém a conexão WebSocket com a EcoRota; planos que "dormem" sem acesso derrubam essa conexão e o mapa para de atualizar.
- O servidor do frontend precisa devolver o `index.html` para qualquer rota, para endereços como `/dashboard` abrirem direto.
