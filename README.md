# EcoRota — trainee 2026.1

MVP de logística reversa: o morador solicita a coleta de material reciclável, a EcoRota (API externa do case) atribui um coletor, e o coletor confirma a retirada. Um painel operacional acompanha tudo em tempo real.

- Consulte [`documents/GUIA-ARQUIVOS.md`](documents/GUIA-ARQUIVOS.md) para entender cada arquivo e o fluxo completo.
- Consulte [`documents/wad.md`](documents/wad.md) para a modelagem de dados, o contrato de endpoints e os requisitos detalhados.
- Consulte [`documents/PLANO.md`](documents/PLANO.md) para o planejamento da equipe.

## Arquitetura e tecnologias

Monólito em camadas (rotas → serviços → repositórios), não microsserviços: o time é pequeno e o prazo é curto, e os três fluxos (morador, coletor, operador) compartilham o mesmo domínio e o mesmo estado operacional da EcoRota.

- **Monorepo `pnpm`**: `apps/api` (backend), `apps/web` (frontend), `packages/shared` (tipos e traduções usados pelos dois lados, como o vocabulário de status de uma coleta).
- **Backend — Fastify + TypeScript**, com **Prisma** sobre **PostgreSQL** (hospedado no Supabase). O frontend nunca fala com a EcoRota diretamente: toda chamada passa pela API própria, atrás da interface `EcoRotaClient`, que isola o contrato externo (HTTP e WebSocket) do resto da aplicação.
- **Autenticação própria**: a EcoRota não modela login. A API cria a sessão com JWT assinado, guardado em cookie `httpOnly`, com o papel do usuário (`MORADOR`, `COLETOR` ou `OPERADOR`). A API aceita login de qualquer papel; cada área do frontend confere o papel da sessão e recusa os outros.
- **Tempo real**: o backend mantém a única conexão WebSocket com a EcoRota (o guia de integração limita o número de conexões simultâneas) e retransmite o estado por Socket.IO às telas autorizadas, filtrado por sala (`usuario:<id>`, `papel:<papel>`).
- **Frontend — React + Vite + Tailwind**, PWA responsiva (mobile para morador/coletor, mais confortável em telas largas para o operador). Mapas com **MapLibre** (leve, sem chave paga), usado no painel operacional e nas telas do morador.

## Pré-requisitos

- Node.js 20+ e `pnpm` (via `corepack enable`, ou instalado globalmente)
- Um banco PostgreSQL: **Docker** (`docker-compose.yml` sobe um Postgres local) **ou** um projeto Supabase
- Opcional: uma credencial (`ECOROTA_URL`/`ECOROTA_KEY`) da API EcoRota do case — sem ela, a integração externa roda em modo simulado (`FakeEcoRotaClient`), sem travar o restante da aplicação

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

# 5. cria as três contas de desenvolvimento (morador, coletor, operador)
pnpm --filter @ecorota/api database:seed:development

# 6. sobe API (porta 3000) e frontend (porta 5173) juntos
pnpm dev
```

Acesse `http://localhost:5173`. A rota inicial (`/`) deixa escolher entre morador, coletor ou operador; cada uma leva ao login da própria área.

## Variáveis de ambiente

Definidas em `.env.example`, sem valores reais. Nunca commitar o `.env` preenchido.

| Variável | Para quê |
|---|---|
| `ECOROTA_URL` | URL base da API EcoRota do case. Opcional: sem ela (e sem `ECOROTA_KEY`), a integração externa roda em modo simulado. |
| `ECOROTA_KEY` | Credencial Bearer da EcoRota. Fica só no backend; o frontend nunca a recebe. |
| `PORT` | Porta da API (padrão 3000). |
| `WEB_ORIGIN` | Origem autorizada pelo CORS e pelo Socket.IO (ex.: `http://localhost:5173`). |
| `VITE_API_URL` | URL da API usada pelo frontend. Lida em tempo de build pelo Vite — variáveis `VITE_` são públicas. |
| `VITE_USE_MOCK` | Só a área do coletor lê esta flag; a API real é o padrão, `true` liga o mock. |
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

Senha: o valor de `DEVELOPMENT_SEED_PASSWORD`, ou a senha padrão definida no próprio script se a variável não estiver preenchida.

## Testando os três perfis

- Abra `http://localhost:5173/` e escolha um perfil; cada área (`/morador`, `/coletor`, `/operador` → `/dashboard`) tem login próprio e recusa contas de outro papel.
- **Só cabe uma sessão por navegador** (o cookie de sessão é único). Para testar dois papéis ao mesmo tempo, abra uma **janela anônima** (ou outro navegador) para o segundo perfil.
- Sem conexão com a API, as telas do morador caem em **modo demonstração** (dados salvos só no dispositivo) em vez de travar.

## Coerência entre perfis (RNF)

- **Login unificado:** morador, coletor e operador usam o mesmo componente `RoleLoginPage`, diferenciados apenas por `eyebrow`, `title`, `description` e `icon`.
- **Navegação por papel:** morador tem navegação inferior com 4 abas (Início, Solicitar, Acompanhar, Histórico); coletor tem 3 abas (Hoje, Disponível, Perfil); operador usa tabs no dashboard (Operação, Pontos).
- **Status traduzidos:** todos os perfis usam `translateStatus` de `packages/shared` para converter códigos técnicos (`pending`, `assigned`, etc.) em rótulos amigáveis ("Aguardando coletor", "Coletor a caminho").
- **Padrão de erros:** mensagens de API seguem o formato `{ codigo, mensagem, detalhes }` — o frontend exibe `mensagem` em português com instrução de ação quando aplicável.
- **Tokens visuais:** `operational` para dashboard/operador, `brand` para morador, `danger` para cancelamentos/arquivamentos.

## Limitações e hipóteses assumidas

- **"Observação para o coletor" não é enviada.** O formulário de solicitação (`SolicitarColetaPage`/`ScheduleStep`) tem um campo de observações, mas o corpo aceito por `POST /solicitacoes-coleta` não tem esse campo — a API rejeitaria a requisição com `additionalProperties: false`. O valor digitado fica só na tela.
- **Só existe um endereço "ativo" por morador na prática.** A API modela vários endereços por morador (`GET/POST /enderecos`, com um marcado como padrão), mas o frontend só tem a tela de cadastrar um endereço; toda solicitação usa o endereço padrão (ou o primeiro cadastrado). Não há lista para trocar entre vários.
- **Prazo mínimo de cancelamento: usa 1 dia, fixo no código.** `request.service.ts` tem `ONE_DAY_MS` como constante (não lê de variável de ambiente). O documento de arquitetura antigo (`documents/Luiz/arquitetura-Luiz.md`) registra 2 horas; os requisitos (`docs_mafe`, RN02) registram 1 dia. Está marcado como pendente de decisão do time nos dois documentos — o código já decidiu por 1 dia, mas isso não foi formalmente confirmado como regra de produto.
- **Modo demonstração quando a API está fora do ar.** As telas do morador (via `checkSession`/`RequireResident`) detectam falha de conexão e seguem operando com dados salvos localmente, em vez de travar a tela.
- **Fila offline do coletor (RNF02):** após um login e carregamento online, as ações de iniciar e concluir coleta ficam no `localStorage` por coletor quando a rede cai. A área do coletor tenta sincronizar ao abrir, reconectar e voltar à aba. Conflitos pausam a fila e podem ser descartados na interface. O PWA guarda a interface para abrir offline após uma primeira visita online; dados da API não são guardados pelo service worker.
- **"Morador ausente" foi descartado, mas não exatamente como o plano original previa.** O plano antigo cancelava a coleta e recriava outra com nova data. O que existe hoje: a solicitação sempre tem um endereço (é para lá que o coletor vai) e a API só permite **cancelamento pelo morador ou pelo operador** — o coletor não tem uma ação de cancelar ou de registrar que não conseguiu concluir. Se o morador não estiver no endereço, hoje não existe como o coletor sinalizar isso pelo app; só resta ele não confirmar a coleta.
