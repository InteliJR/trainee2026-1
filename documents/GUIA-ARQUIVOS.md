# Guia de arquivos e fluxo do projeto EcoRota

Este guia explica a responsabilidade de cada arquivo do repositório. Ele complementa os comentários dentro do código e cobre também formatos que não aceitam comentários, arquivos gerados e artefatos que não devem ser editados manualmente.

## 1. Fluxo geral em execução

```text
React/Vite
  -> REST Fastify (/api/v1)
  -> serviços de negócio
  -> repositórios Prisma
  -> PostgreSQL/Supabase

EcoRota HTTP
  <- criação/cancelamento/conclusão e disponibilidade

EcoRota WebSocket
  -> validação da mensagem
  -> OperationState em memória
  -> sincronização do domínio no PostgreSQL
  -> Socket.IO /tempo-real
  -> salas autorizadas do React
```

O backend é um monólito modular. As rotas tratam HTTP, os serviços aplicam autorização e regras, os repositórios acessam o banco e a pasta `integration` isola a EcoRota.

## 2. Raiz do monorepo

| Arquivo | O que acontece |
|---|---|
| `.env.example` | Modelo seguro das variáveis de banco, EcoRota, JWT, origem web e URL pública da API. O `.env` real não é versionado. |
| `.gitignore` | Impede o commit de segredos, dependências, builds e arquivos temporários. |
| `package.json` | Define o monorepo e os comandos agregados `dev`, `build`, `test` e `typecheck`. |
| `pnpm-workspace.yaml` | Informa ao pnpm que `apps/*` e `packages/*` pertencem ao mesmo workspace. |
| `pnpm-lock.yaml` | Congela versões exatas de todas as dependências; é atualizado pelo pnpm e não deve ser comentado manualmente. |
| `tsconfig.base.json` | Configuração TypeScript comum: ES2022, NodeNext, modo estrito e geração de declarações. |
| `docker-compose.yml` | Configuração legada de PostgreSQL local. A decisão atual do MVP é usar Supabase, portanto este arquivo não participa do fluxo normal. |
| `README.md` | Entrada geral do repositório. |

## 3. Pacote compartilhado

| Arquivo | O que acontece |
|---|---|
| `packages/shared/package.json` | Declara o pacote `@ecorota/shared` consumido por API e web. |
| `packages/shared/tsconfig.json` | Aplica a configuração TypeScript ao pacote compartilhado. |
| `packages/shared/src/index.ts` | Reexporta os contratos públicos do pacote. |
| `packages/shared/src/status.ts` | Define status externos e a tradução de seus rótulos. |
| `packages/shared/src/types/ecorota.ts` | Define ponto, demanda, coletor, posição, snapshot e evento usados nos dois lados. |

## 4. Configuração da API

| Arquivo | O que acontece |
|---|---|
| `apps/api/package.json` | Dependências e scripts da API, Prisma, Vitest, Fastify, WebSocket e Socket.IO. |
| `apps/api/tsconfig.json` | Compila `src` para `dist` usando as regras TypeScript comuns. |
| `apps/api/vitest.config.ts` | Faz o Vitest coletar somente `tests/**/*.test.ts`. |
| `apps/api/prisma.config.ts` | Carrega o `.env` raiz e escolhe `DIRECT_URL` para executar migrations. |
| `apps/api/src/config/env.ts` | Carrega o `.env` e exporta a configuração validada. |
| `apps/api/src/config/validateEnv.ts` | Valida porta, ambiente, URLs PostgreSQL/HTTP, pares de credenciais, origem web e segredo JWT. |
| `apps/api/src/types/fastify.d.ts` | Acrescenta `request.actor` ao tipo de requisição do Fastify. |

## 5. Inicialização da API

| Arquivo | O que acontece |
|---|---|
| `apps/api/src/app.ts` | Monta Fastify, cookie, CORS, autenticação JWT, handlers e módulos REST sem abrir porta. |
| `apps/api/src/server.ts` | Cria Prisma, integração HTTP/WS, sincronizador e Socket.IO; conecta banco, abre a porta e executa shutdown ordenado. |
| `apps/api/src/infra/database/prisma.ts` | Constrói o Prisma Client com o adaptador PostgreSQL. |

## 6. Identidade e erros

| Arquivo | O que acontece |
|---|---|
| `apps/api/src/auth/actor.ts` | Define o ator mínimo usado nas autorizações. |
| `apps/api/src/auth/authToken.ts` | Emite e valida JWT HS256 e centraliza nome/duração/flags do cookie de sessão. |
| `apps/api/src/auth/authentication.ts` | Lê o cookie, confirma usuário/papel no banco e fornece guards RBAC. |
| `apps/api/src/modules/auth/auth.schemas.ts` | Valida cadastro público e login. |
| `apps/api/src/modules/auth/auth.repository.ts` | Consulta credenciais e cria usuário/perfil de coletor em transação. |
| `apps/api/src/modules/auth/auth.service.ts` | Normaliza dados, aplica bcrypt e protege mensagens de login. |
| `apps/api/src/modules/auth/auth.routes.ts` | Expõe cadastro, entrada, sessão e saída em português. |
| `apps/api/src/errors/appError.ts` | Representa erros esperados com status, código e mensagem pública. |
| `apps/api/src/errors/errorHandler.ts` | Converte erros da aplicação, validações e exceções em respostas HTTP uniformes. |

## 7. Módulo de saúde

| Arquivo | O que acontece |
|---|---|
| `health.repository.ts` | Executa uma consulta mínima no PostgreSQL. |
| `health.service.ts` | Retorna API/banco saudáveis ou lança indisponibilidade. |
| `health.routes.ts` | Registra `GET /api/v1/saude`. |

Os três arquivos ficam em `apps/api/src/modules/health/`.

## 8. Módulo de endereços

| Arquivo | O que acontece |
|---|---|
| `address.schemas.ts` | Define entrada e JSON Schema de endereço. |
| `address.repository.ts` | Cria/lista endereços e troca o padrão de forma transacional. |
| `address.service.ts` | Exige papel MORADOR, normaliza dados e serializa a resposta. |
| `address.routes.ts` | Registra criação e listagem em `/api/v1/enderecos`. |

Os arquivos ficam em `apps/api/src/modules/addresses/`.

## 9. Módulo de solicitações

| Arquivo | O que acontece |
|---|---|
| `request.schemas.ts` | Traduz materiais/status e valida criação, cancelamento, atribuição e conclusão. |
| `request.repository.ts` | Persiste o agregado, usa transações, trava duplicidade, grava histórico e pontos. |
| `request.service.ts` | Aplica antecedência, RBAC, transições e chamadas HTTP à EcoRota. |
| `request.routes.ts` | Expõe criação, consulta, cancelamento, atribuição, início e conclusão. |

Os arquivos ficam em `apps/api/src/modules/requests/`.

## 10. Módulo do coletor

| Arquivo | O que acontece |
|---|---|
| `collector.schemas.ts` | Valida filtros e alteração de disponibilidade/turno. |
| `collector.repository.ts` | Lê e atualiza o perfil do coletor no PostgreSQL. |
| `collector.service.ts` | Exige COLETOR, consulta coletas e sincroniza disponibilidade com a EcoRota. |
| `collector.routes.ts` | Expõe perfil, coletas atribuídas e disponibilidade. |

Os arquivos ficam em `apps/api/src/modules/collectors/`.

## 11. Gamificação

| Arquivo | O que acontece |
|---|---|
| `gamification.repository.ts` | Soma e lista lançamentos de pontos do usuário. |
| `gamification.service.ts` | Autoriza morador/coletor e monta saldo/histórico. |
| `gamification.routes.ts` | Expõe consultas de pontos; não existe endpoint público para concedê-los. |

Os arquivos ficam em `apps/api/src/modules/gamification/`.

## 12. Estado operacional REST

| Arquivo | O que acontece |
|---|---|
| `operation.schemas.ts` | Valida latitude, longitude, raio e ID de ponto. |
| `operationIndicators.repository.ts` | Conta no PostgreSQL coletas concluídas/canceladas e novos moradores por dia, semana e mês. |
| `operation.service.ts` | Lê o cache, calcula distância e combina indicadores históricos com demanda, capacidade e telemetria operacional. |
| `operation.routes.ts` | Expõe pontos próximos, detalhe, coletores disponíveis, integração e indicadores administrativos. |

Os arquivos ficam em `apps/api/src/modules/operation/`.

## 13. Contrato e HTTP da EcoRota

| Arquivo | O que acontece |
|---|---|
| `integration/ecorotaClient.ts` | Define solicitações, rotas, snapshots, envelopes e a interface do cliente. |
| `integration/http/httpEcoRotaClient.ts` | Faz chamadas reais com Bearer, timeout, validação e erros normalizados. |
| `integration/fake/fakeEcoRotaClient.ts` | Simula a EcoRota em memória para testes e verificadores locais. |

## 14. WebSocket externo e cache

| Arquivo | O que acontece |
|---|---|
| `operation-state/index.ts` | Reexporta o cache operacional. |
| `operation-state/operationState.ts` | Guarda snapshot, aplica eventos por geração/revisão, deduplica e notifica listeners. |
| `ws/streamMessage.ts` | Faz parse e validação estrutural das mensagens externas. |
| `ws/systemState.repository.ts` | Persiste o cursor de geração/revisão. |
| `ws/ecoRotaWsConsumer.ts` | Abre o WSS com Bearer, processa em série e reconecta com backoff/jitter. |

## 15. Sincronização do domínio

| Arquivo | O que acontece |
|---|---|
| `sync/ecorotaDomainSynchronizer.ts` | Encaminha snapshots/eventos de solicitação ao repositório e resume resultados. |
| `sync/ecorotaRequestSync.repository.ts` | Atualiza solicitação, coletor, histórico e pontos em transação idempotente. |

## 16. Socket.IO interno

| Arquivo | O que acontece |
|---|---|
| `realtime/realtimeAccess.repository.ts` | Resolve ator, referências permitidas e destinatários no banco. |
| `realtime/socketServer.ts` | Autoriza handshake, cria salas, filtra snapshots e traduz/distribui eventos. |

O namespace é `/tempo-real`; o caminho de transporte é `/socket.io`. Produção continua bloqueada até a autenticação JWT.

## 17. Prisma e banco

| Arquivo | O que acontece |
|---|---|
| `prisma/schema.prisma` | Fonte do modelo: enums, oito entidades, relações, índices e restrições. |
| `prisma/migrations/20260923000000_initial_schema/migration.sql` | Migration inicial já aplicada: cria tipos, tabelas, índices, FKs e RLS. Não deve ser reescrita. |
| `prisma/migrations/20260924000000_allow_shared_event_revision/migration.sql` | Ajusta a unicidade para aceitar eventos distintos na mesma revisão. Não deve ser reescrita. |
| `prisma/migrations/migration_lock.toml` | Registra PostgreSQL como provider das migrations. |

### Código Prisma gerado

Todos os arquivos abaixo são derivados de `schema.prisma` por `prisma generate` e não devem receber edição manual:

- `generated/prisma/browser.ts` e `client.ts`: entradas do cliente;
- `generated/prisma/enums.ts`: enums TypeScript;
- `generated/prisma/commonInputTypes.ts`: filtros e entradas comuns;
- `generated/prisma/models.ts`: índice dos modelos;
- `generated/prisma/models/Address.ts`;
- `generated/prisma/models/CollectionRequest.ts`;
- `generated/prisma/models/CollectorProfile.ts`;
- `generated/prisma/models/PointsLog.ts`;
- `generated/prisma/models/RequestMaterial.ts`;
- `generated/prisma/models/RequestStatusHistory.ts`;
- `generated/prisma/models/SystemState.ts`;
- `generated/prisma/models/User.ts`;
- `generated/prisma/internal/class.ts`;
- `generated/prisma/internal/prismaNamespace.ts`;
- `generated/prisma/internal/prismaNamespaceBrowser.ts`.

Comentários nesses arquivos seriam apagados na próxima geração.

## 18. Scripts executáveis

| Arquivo | O que acontece |
|---|---|
| `seed-development.ts` | Cria usuários fixos dos três papéis por upsert. |
| `verify-database.ts` | Confere tabelas, RLS e saúde do banco. |
| `verify-authentication.ts` | Cadastra um coletor artificial, valida bcrypt/JWT/sessão/logout no Supabase e remove a conta ao final. |
| `verify-first-flow.ts` | Executa o fluxo endereço → solicitação → conclusão → pontos. |
| `verify-domain-sync.ts` | Valida sincronização idempotente de eventos externos. |
| `verify-collector-flow.ts` | Valida perfil, coletas e disponibilidade do coletor. |

## 19. Testes da API

| Arquivo | O que cobre |
|---|---|
| `env.test.ts` | Ambiente válido, URL de banco e porta inválidos. |
| `errors.test.ts` | Contrato padronizado de erros. |
| `health.test.ts` | Saúde com banco disponível e indisponível. |
| `auth.test.ts` | Cadastro, bcrypt, cookie JWT, sessão, logout e validação pública de papéis. |
| `first-flow.test.ts` | Regras de negócio do primeiro fluxo. |
| `collector-service.test.ts` | Regras do CollectorService. |
| `ecorota-client.test.ts` | Clientes fake/HTTP e tratamento de falhas externas. |
| `ecorota-stream.test.ts` | URL WSS, parser e backoff. |
| `ecorota-domain-synchronizer.test.ts` | Seleção e resumo da sincronização. |
| `operation-state.test.ts` | Snapshot, eventos, revisão e deduplicação. |
| `operation-service.test.ts` | Distância, filtros e serialização operacional. |
| `operation-routes.test.ts` | Endpoints operacionais e validação de query. |
| `socket-server.test.ts` | Handshake real, privacidade do snapshot e evento de atribuição. |

Todos ficam em `apps/api/tests/`.

## 20. Frontend

| Arquivo | O que acontece |
|---|---|
| `apps/web/package.json` | Declara React, Vite, MapLibre, Socket.IO Client, Tailwind e scripts. |
| `apps/web/pnpm-lock.yaml` | Lockfile antigo/local do app; o lockfile canônico do monorepo é o da raiz. |
| `apps/web/tsconfig.json` | Habilita JSX, resolução Bundler e os tipos públicos fornecidos pelo Vite. |
| `apps/web/vite.config.ts` | Carrega o `.env` raiz e encaminha `/api` para o Fastify local. |
| `apps/web/tailwind.config.ts` | Define os arquivos examinados para gerar classes Tailwind. |
| `apps/web/postcss.config.js` | Executa Tailwind e Autoprefixer. |
| `apps/web/index.html` | Documento HTML mínimo com o elemento `#root`. |
| `apps/web/src/main.tsx` | Inicializa a raiz React. |
| `apps/web/src/App.tsx` | Define o roteamento e direciona a rota padrão para o dashboard em tempo real. |
| `apps/web/src/index.css` | Carrega base, componentes e utilitários Tailwind. |
| `apps/web/src/features/dashboard/RealtimeDashboard.tsx` | Exibe estado da conexão e entrega snapshots autorizados ao mapa. |
| `apps/web/src/map/MapContainer.tsx` | Cria o MapLibre uma vez, atualiza pontos/coletores separadamente e sinaliza telemetria antiga. |
| `apps/web/src/realtime/socketClient.ts` | Tipifica snapshots/eventos e cria o cliente `/tempo-real` com cookie JWT, credenciais e reconexão. |
| `apps/web/src/realtime/useTempoReal.ts` | Liga o Socket.IO ao React e aplica snapshots/deltas em ordem por geração e revisão. |
| `apps/web/src/realtime/useTempoReal.test.ts` | Valida ordenação, atualização de posição, mudança de solicitação e rejeição de geração antiga. |

## 21. Pastas reservadas

Arquivos `.gitkeep` não executam código; existem apenas para o Git preservar diretórios vazios. Atualmente reservam:

- infraestrutura e adaptadores ainda vazios;
- módulos futuros `auth`, `dashboard` e `users`;
- áreas React de componentes, biblioteca e funcionalidades de morador/coletor/dashboard;
- pasta pública do frontend.

Quando um arquivo real for criado na pasta, o `.gitkeep` pode ser removido.

## 22. Documentação

| Arquivo | Finalidade |
|---|---|
| `documents/wad.md` | Documento arquitetural principal e distinção entre planejado/implementado. |
| `documents/PLANO.md` | Plano de divisão e cronograma da equipe. |
| `documents/AnaCélia/requisitos_funcionais.md` | Requisitos funcionais organizados pela equipe. |
| `documents/Maria Fernanda/docs_mafe` | Fonte de requisitos e regras utilizada na consolidação. |
| `documents/Luiz/arquitetura-Luiz.md` | Estudo arquitetural anterior; mantido como referência e não atualizado nesta etapa. |
| `documents/William/guia-de-estilos.md` | Guia textual de identidade visual. |
| `documents/William/guia_de_estilos.png` | Referência visual do guia de estilos. |
| `documents/William/docs_will` | Material complementar de design. |
| `documents/Dev1/cronograma-dev1.md` | Cronograma e responsabilidades do Dev 1. |
| `documents/Dev1/planejamento-primeiro-fluxo.md` | Etapas do primeiro fluxo. |
| `documents/Dev1/planejamento-integracao-ecorota.md` | Planejamento do cliente HTTP externo. |
| `documents/Dev1/planejamento-websocket-ecorota.md` | Planejamento do consumidor WSS. |
| `documents/Dev1/planejamento-sincronizacao-dominio.md` | Planejamento da reconciliação com PostgreSQL. |
| `documents/Dev1/planejamento-estado-operacional.md` | Planejamento do cache e consultas operacionais. |
| `documents/Dev1/planejamento-gestao-coletor.md` | Planejamento do módulo do coletor. |
| `documents/Dev1/planejamento-socketio.md` | Contrato, segurança e uso do Socket.IO. |
| `documents/GUIA-ARQUIVOS.md` | Este inventário do código e do fluxo completo. |

## 23. Como ler uma requisição completa

Para acompanhar o caminho de uma solicitação, leia nesta ordem:

1. `request.routes.ts`: recebe HTTP e ator;
2. `request.schemas.ts`: valida a entrada;
3. `request.service.ts`: aplica regra e chama integração;
4. `request.repository.ts`: persiste transação e histórico;
5. `httpEcoRotaClient.ts`: envia a ação à EcoRota;
6. `ecoRotaWsConsumer.ts`: recebe a confirmação posterior;
7. `operationState.ts`: atualiza o cache;
8. `ecorotaDomainSynchronizer.ts` e `ecorotaRequestSync.repository.ts`: reconciliam o banco;
9. `socketServer.ts`: envia a atualização às salas autorizadas;
10. `socketClient.ts`: entrega o evento à futura tela React.
