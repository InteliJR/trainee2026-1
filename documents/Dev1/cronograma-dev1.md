# Cronograma de execução — Dev 1 (Backend EcoRota)

Atualizado em **27/09/2026**, com base no `PLANO.md` e no estado atual do código em `apps/api`.

## 1. Responsabilidade do Dev 1

O Dev 1 é responsável por construir a base do backend que destrava o trabalho dos outros integrantes:

1. consumir o WebSocket da EcoRota com segurança e resiliência;
2. manter o estado operacional de pontos, coletores e solicitações em memória;
3. isolar a integração externa atrás de um `EcoRotaClient`;
4. modelar e persistir os dados próprios da aplicação com Prisma e PostgreSQL;
5. implementar cadastro, login, JWT em cookie `httpOnly` e autorização por papel;
6. implementar as regras de solicitações, disponibilidade de coletores e gamificação;
7. entregar contratos e endpoints estáveis para os Devs 2, 3 e 4.

## 2. O que existe atualmente no projeto

| Área | Situação atual | Evidência | Próximo passo |
|---|---|---|---|
| Bootstrap da API | **Concluído** | Fastify inicia em `src/server.ts`; módulos usam `/api/v1`; erros, cookie, CORS, Socket.IO e shutdown estão registrados | Configurar variáveis do ambiente publicado |
| Variáveis de ambiente | **Concluído** | `src/config/env.ts` exige banco e `JWT_SECRET`, valida URLs, CORS e pares EcoRota | Configurar os segredos reais em cada ambiente de deploy |
| Tipos compartilhados | **Implementados para a integração atual** | `packages/shared` define pontos, coletores, posição, snapshot e eventos; contratos específicos REST ficam nos módulos | Evoluir somente quando o contrato EcoRota mudar |
| `OperationState` | **Implementado para stream, consultas e indicadores** | Snapshot e eventos mantêm o cache; endpoints expõem pontos, coletores e KPIs por circuito com distância, capacidade e telemetria | Validar com o snapshot real e conectar os indicadores ao frontend |
| Consumidor WebSocket EcoRota | **Implementado, aguardando credencial** | Conexão WSS, Bearer, parser, snapshot, deduplicação, revisão/geração, cursor, reconexão e sincronização com o domínio possuem testes | Validar conexão, queda e retorno no ambiente real |
| `EcoRotaClient` | **Implementado, aguardando validação real** | Interface, adaptadores HTTP/fake, timeout, contrato e retry exponencial com jitter implementados | Ativar com a credencial e validar no ambiente real |
| Proxy REST EcoRota | **Concluído** | `integration/http/httpEcoRotaClient.ts` implementa criação, cancelamento, conclusão, snapshot, pontos e coletores com retry | Validar com a credencial real da equipe |
| Prisma/PostgreSQL | **Concluído** | Oito entidades, migrations, RLS, cliente tipado e repositórios estão aplicados no Supabase | Criar novas migrations somente para mudanças aprovadas no WAD |
| Autenticação e RBAC | **Concluído no backend** | Cadastro, login, sessão, logout, bcrypt, cookie JWT, confirmação no banco e guards por papel possuem testes | Conectar as telas de login e validar o cookie no ambiente publicado |
| Solicitações | **Concluído para o MVP** | Rotas, regras, idempotência, histórico, atribuição, início, cancelamento, conclusão e sincronização estão implementados | Substituir regras provisórias quando o negócio aprovar valores definitivos |
| Coletores | **Implementado para o primeiro fluxo** | Módulo possui solicitações atribuídas, consulta e alteração de disponibilidade com sincronização opcional | Validar com coletor custom real da EcoRota |
| Gamificação | **Concluído para o primeiro fluxo** | Créditos idempotentes são gerados somente após conclusão e podem ser consultados pelo próprio usuário | Implementar classificação e regras definitivas em etapa posterior |
| Tempo real para o frontend | **Concluído no backend** | `socketServer.ts` usa cookie JWT, salas privadas e filtros de snapshot/eventos | Conectar as telas restantes no frontend |
| Testes | **Cobertura dos fluxos principais** | Autenticação, regras, integração, cache, rotas e Socket.IO possuem testes automatizados | Acrescentar testes com credenciais externas no ambiente da equipe |
| Ambiente local | **Preparado** | Dependências e comandos via `corepack pnpm` estão configurados | Preencher `JWT_SECRET`, credenciais EcoRota e senha opcional do seed |

### Resumo objetivo

O Dev 1 concluiu a fundação, modelagem, primeiro fluxo, integração HTTP/WSS, sincronização do domínio, indicadores, autenticação JWT/RBAC e segurança do Socket.IO. O único item dependente de estado externo é validar a credencial EcoRota real e configurar os segredos do ambiente de deploy.

## 3. Cronograma recomendado

| Dia | Foco | Entregáveis | Critério de conclusão |
|---:|---|---|---|
| **0** | Preparar ambiente | Dependências instaladas, `.env` local e PostgreSQL funcionando | `typecheck`, teste de health e conexão com banco executam sem erro |
| **1** | Contratos da integração | `EcoRotaClient`, tipos de snapshot/eventos e `FakeEcoRotaClient` | Serviços podem usar o fake sem conhecer HTTP ou WebSocket |
| **2** | WebSocket — conexão e snapshot | Cliente WSS autenticado; parser; aplicação do snapshot inicial | Snapshot substitui integralmente o estado anterior |
| **3** | WebSocket — consistência e resiliência | Dedup por `id`; `revision/generation`; backoff com jitter; testes | Evento duplicado ou antigo não altera o estado; reconexão é automática |
| **4** | Banco e Prisma | Models completos, migration inicial e repositories básicos | Migration sobe em banco vazio; Prisma Client lê e grava dados |
| **5** | Autenticação e autorização | `register`, `login`, logout opcional, JWT em cookie e guards RBAC | Usuário autenticado acessa somente rotas permitidas ao seu papel |
| **6** | Solicitações e proxy REST | Criar, listar, cancelar e concluir; `externalReference`; idempotência | Fluxo persiste localmente e sincroniza com a EcoRota sem duplicação |
| **7** | Coletores e gamificação | Disponibilidade do coletor; listener `request.completed`; `PointsLog` | Pontos só são creditados após conclusão confirmada |
| **8** | Robustez e entrega | Erros 401/403/409/429; testes; documentação; handoff ao Dev 4 | Fluxo integrado está verde e contratos estão documentados |
| **9** | Integração geral | Morador solicita → EcoRota atribui → coletor conclui → pontos | Jornada completa funciona com frontend e tempo real |
| **10** | Deploy e demo | Variáveis seguras, migration de produção e ensaio | Serviço publicado, health check verde e roteiro de demo validado |

## 4. Como executar o plano

### Dia 0 — preparar o ambiente

Objetivos:

- instalar as dependências do monorepo;
- configurar as variáveis no `.env`;
- conectar o Prisma ao PostgreSQL hospedado no Supabase.

Na raiz do repositório:

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env
```

Não é necessário instalar PostgreSQL localmente nem usar Docker. Crie o projeto no Supabase e copie a string exibida em **Connect → Session pooler**.

Preencher o `.env` local sem commitar credenciais:

```dotenv
ECOROTA_URL=https://ecorota.marcusvalente.dev.br
ECOROTA_KEY=<credencial-do-ambiente>
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<SENHA>@<POOLER_HOST>:5432/postgres
JWT_SECRET=<segredo-longo-e-aleatorio>
PORT=3000
```

Instalar as dependências ainda ausentes:

```powershell
corepack pnpm --filter @ecorota/api add ws @prisma/client @fastify/cookie @fastify/jwt argon2
corepack pnpm --filter @ecorota/api add -D prisma @types/ws
```

Validar a base:

```powershell
corepack pnpm --filter @ecorota/api typecheck
corepack pnpm --filter @ecorota/api test
corepack pnpm --filter @ecorota/api dev
```

### Dias 1–3 — integração WebSocket

Ordem de implementação:

1. criar `src/integration/ecoRotaClient.ts`;
2. criar `src/integration/fake/fakeEcoRotaClient.ts` para desenvolvimento e testes;
3. criar `src/integration/ws/ecoRotaWsConsumer.ts`;
4. validar cada mensagem antes de aplicá-la;
5. no snapshot, substituir o estado inteiro;
6. manter um conjunto limitado de IDs já processados;
7. rejeitar `revision` menor ou igual à última aplicada;
8. resetar corretamente quando `generation` mudar;
9. reconectar com backoff exponencial, jitter e limite máximo;
10. emitir deltas para o `OperationState` e para o broker do Dev 4.

Testes mínimos:

- snapshot substitui estado anterior;
- evento novo altera somente a entidade esperada;
- evento duplicado é ignorado;
- revisão antiga é ignorada;
- nova `generation` reinicia o controle de revisão;
- desconexão agenda reconexão sem loop agressivo.

### Dia 4 — Prisma e PostgreSQL

Models mínimos:

- `User`;
- `Address`;
- `CollectorProfile`;
- `Request`;
- `PointsLog`;
- `SystemState`.

Comandos:

```powershell
corepack pnpm --filter @ecorota/api exec prisma format
corepack pnpm --filter @ecorota/api exec prisma migrate dev --name init_backend
corepack pnpm --filter @ecorota/api exec prisma generate
```

Decisões obrigatórias:

- `User.email` deve ser único;
- `Request.externalReference` deve ser único;
- armazenar o ID retornado pela EcoRota;
- guardar status local e timestamps;
- distinguir coletor `system` de `custom`;
- registrar pontos em log, sem atualizar saldo diretamente pela tela;
- persistir `generation/revision` para recuperação após reinício.

### Dia 5 — autenticação e RBAC

Criar:

```text
src/modules/auth/auth.routes.ts
src/modules/auth/auth.service.ts
src/modules/auth/auth.schemas.ts
src/modules/auth/auth.guard.ts
src/modules/users/user.repository.ts
```

Endpoints mínimos:

```text
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/logout
```

Regras:

- nunca armazenar senha em texto puro;
- assinar JWT com expiração curta;
- enviar JWT em cookie `httpOnly`, `SameSite` e `secure` em produção;
- retornar `401` para não autenticado e `403` para papel inadequado;
- não revelar se um e-mail existe em mensagens sensíveis de login.

### Dia 6 — solicitações

Endpoints mínimos:

```text
POST /requests
GET  /requests/:id
GET  /me/requests
POST /requests/:id/cancel
POST /collector/requests/:id/complete
```

Fluxo de criação:

```text
validar usuário/endereço/data
  → impedir solicitação duplicada
  → gerar externalReference
  → persistir como pendente
  → chamar EcoRotaClient.createRequest
  → salvar ID/status externo
  → responder ao frontend
```

Se a chamada externa falhar, a situação local deve ficar identificável para retry ou compensação; não deixar uma solicitação silenciosamente inconsistente.

### Dia 7 — coletores e gamificação

Implementar:

- `POST /collector/availability`;
- `GET /collector/requests`;
- validação de coletor `custom` antes da conclusão;
- listener de `request.completed`;
- criação idempotente de `PointsLog`;
- consulta `GET /me/rewards`.

O listener precisa ser idempotente: receber o mesmo evento duas vezes não pode conceder pontos duas vezes.

### Dias 8–10 — robustez, integração e entrega

Checklist:

- mapear erros externos para respostas estáveis;
- respeitar a cota de 300 requisições/minuto;
- mascarar credenciais nos logs;
- registrar shutdown do WebSocket, Socket.IO, Fastify e Prisma;
- testar queda e retorno da EcoRota;
- testar reinício da API sem duplicar eventos/pontos;
- documentar variáveis, rotas e exemplos de payload;
- entregar ao Dev 4 o contrato dos eventos Socket.IO;
- executar a jornada completa com os Devs 2, 3 e 4;
- aplicar migrations no ambiente de deploy antes de iniciar a API.

## 5. Rotina diária recomendada

No início do dia, confirme que o projeto do Supabase está disponível e execute:

```powershell
corepack pnpm --filter @ecorota/api typecheck
corepack pnpm --filter @ecorota/api test
```

Durante o desenvolvimento:

```powershell
corepack pnpm --filter @ecorota/api dev
```

Antes de entregar:

```powershell
corepack pnpm --filter @ecorota/api typecheck
corepack pnpm --filter @ecorota/api test
corepack pnpm --filter @ecorota/api build
git status --short
```

## 6. Definition of Done do Dev 1

Uma tarefa só pode ser marcada como concluída quando:

- o código está tipado e sem erros de compilação;
- existe pelo menos um teste do caminho feliz e um teste de erro relevante;
- nenhuma credencial aparece no frontend, logs ou repositório;
- falhas externas produzem resposta controlada;
- eventos repetidos não duplicam estado nem pontos;
- migrations e contratos estão versionados;
- o integrante dependente consegue usar a entrega sem conhecer detalhes internos;
- o README ou documento do módulo explica como executar e validar.

## 7. Dependências que o Dev 1 desbloqueia

```text
WS Consumer + OperationState
    └── desbloqueia Socket.IO e mapa ao vivo do Dev 4

Banco + Auth + Requests
    ├── desbloqueia formulários do morador do Dev 2
    └── desbloqueia painel e conclusão do coletor do Dev 3

Eventos de conclusão + PointsLog
    └── desbloqueia histórico e gamificação do Dev 2
```

## 8. Riscos atuais

1. **Dependências não instaladas:** hoje não é possível executar `tsc` ou `vitest` porque `node_modules` está ausente.
2. **Credencial externa ausente:** o `OperationState` está pronto para dados reais, mas permanece vazio até receber o primeiro snapshot autenticado da EcoRota.
3. **Socket.IO não registrado:** o arquivo existe, mas o bootstrap atual cria apenas o Fastify e a rota de health.
4. **Schema incompleto:** apenas `User` existe e o pacote Prisma ainda não está instalado.
5. **Sem autenticação:** qualquer integração de frontend com login está bloqueada.
6. **Sem testes do domínio:** deduplicação, revisão, idempotência e pontuação ainda não possuem proteção automatizada.
