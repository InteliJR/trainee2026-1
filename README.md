# EcoRota — trainee 2026.1

Monorepo do MVP com API Fastify/Prisma, frontend React/MapLibre, PostgreSQL no Supabase e integrações EcoRota por HTTP e WebSocket. O backend retransmite atualizações autorizadas ao frontend por Socket.IO.

- Consulte [`documents/GUIA-ARQUIVOS.md`](documents/GUIA-ARQUIVOS.md) para entender cada arquivo e o fluxo completo.
- Consulte [`documents/wad.md`](documents/wad.md) para arquitetura, requisitos e decisões técnicas.
- Consulte [`documents/PLANO.md`](documents/PLANO.md) para o planejamento da equipe.

Comandos principais:

```bash
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
corepack pnpm dev
```

Antes de iniciar a API, defina `JWT_SECRET` com pelo menos 32 caracteres no `.env`. Para preparar e verificar a autenticação contra o Supabase:

```bash
corepack pnpm --filter @ecorota/api database:seed:development
corepack pnpm --filter @ecorota/api auth:verify
```
