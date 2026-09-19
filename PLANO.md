# Roteiro de Implementação — EcoRota

Plano em fases para sair do zero à demo. Cada fase tem **entregável executável** e **critério de aceite**. Base: `arquitetura-Luiz.md` e requisitos da `docs_mafe`.

> **Decisão registrada:** o backend começa pela **integração EcoRota** e usa o **dashboard como harness** (tela que valida visualmente o pipeline WS). O dashboard nasce com **dev-mode flag** (opção 1) e é trancado com guard `ROL_GESTOR` antes do deploy.

---

## Fase 0 — Setup do ambiente e credencial (ECOROTA)

**O que fazer:**
1. Copiar `.env.example` → `.env` e preencher a credencial (o `.env` deste repo já vem pronto no desenvolvimento local; **nunca commitar**).
2. Validar a chave com uma chamada de leitura:
   ```bash
   curl -H "Authorization: Bearer $ECOROTA_KEY" $ECOROTA_URL/v1/environment
   ```
   Deve responder com `generation`, `revision`, `maxCollectors`, `observedAt`.
3. Garantir que `.env` está fora do git (`git status` não pode listá-lo).

**Critério de aceite:** `GET /v1/environment` responde 200 com os dados do ambiente e nada de segredo aparece no repositório.

---

## Fase 1 — Scaffold do monorepo (Node + TypeScript)

**O que fazer:**
1. Criar a estrutura `apps/api`, `apps/web` e `packages/shared` (workspaces npm/pnpm).
2. `apps/api`: Fastify + TypeScript + tsx (dev) + vitest.
3. `apps/web`: Vite + React + Tailwind.
4. `packages/shared`: tipos de domínio + **tabela de tradução de status** (pending → "aguardando coletor", in_service → "coletor a caminho", etc.) + tipagem dos eventos da EcoRota.
5. Health check `/health` na API (sem tocar a EcoRota ainda).

**Critério de aceite:** `pnpm dev` sobe API e web; `/health` responde 200; `packages/shared` é importável pelos dois apps.

---

## Fase 2 — Integração com a EcoRota (o coração)

**O que fazer:**
1. `EcoRotaClient` (interface) com implementações `HttpClient` e `WsClient` isoladas em módulo próprio.
2. Consumidor WS: aplicar `snapshot` integral, deduplicar por `id`, respeitar `revision`/`generation`, reconexão com backoff exponencial + jitter, comparar `observedAt` (telemetria velha).
3. `OperationState`: cache em memória do estado operacional (pontos, coletores, rotas, solicitações) + `SystemState` no banco (última `generation`/`revision`).
4. Fallback de polling `GET /v1/snapshot` a cada 5 s quando o WS cair.
5. Testes com `FakeEcoRotaClient` (zero chamada real na suíte).

**Critério de aceite:** o backend mantém o estado operacional atualizado sozinho (WS), mesmo após quedas simuladas; consumo fica bem abaixo de 300 req/min.

---

## Fase 3 — Dashboard cedo, como harness (dev-mode flag)

Dashboard-base antes de auth: é o jeito mais barato de **ver** a Fase 2 funcionando (coletores andando no mapa = pipeline OK; mapa congelado = integração com problema). Só lê o `OperationState` — não escreve no banco e não chama a EcoRota.

**O que fazer:**
1. `.env`: `DEV_MODE=true` (ou `DASHBOARD_PUBLIC=true`); com a flag ligada, `/dashboard` e `/api/dashboard/*` ficam **abertos** (sem login) apenas em dev/demo.
2. KPIs frontais: `GET /dashboard/stats` com agregados pré-computados sobre o `OperationState` (RF18.1, RF18.3).
3. Mapa operacional em tempo real: pipeline EcoRota WS → `OperationState` → Socket.IO → MapLibre; posição com `observedAt` velho marcada como congelada (RF18.2).
4. Lista de solicitações recentes (leitura do cache, útil para debug).

**Critério de aceite:** com `DEV_MODE=true`, abrir `/dashboard` e ver a operação se mover em tempo real em < 3 s (RNF03), sem queimar cota.
**Atenção (risco controlado):** a flag é temporária — quem vai ao ar é a Fase 7, que **troca a flag por guard `ROL_GESTOR`**.

---

## Fase 4 — Autenticação e usuários (RF01, RF02, RF03)

**O que fazer:**
1. Prisma + banco (PostgreSQL; SQLite nos primeiros dias se preferir).
2. Migrations: `User` (role MORADOR/COLETOR/GESTOR, senha hash), `Address`.
3. `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` → JWT em cookie httpOnly.
4. RBAC: guardas que restringem rotas por papel (RNF05) — **inclui o guard `GESTOR` do dashboard** (mesmo RBAC, uma linha).
5. `PUT /me/address`.

**Critério de aceite:** cadastro/login funcionam no browser; um `MORADOR` não acessa rota de `COLETOR`; 401 sem cookie.

---

## Fase 5 — Área do morador (RF04–RF07, RF12, RF13, RF15, RF16, RF17)

**O que fazer:**
1. Descoberta: `GET /points` (serve do `OperationState`, GeoJSON) + mapa MapLibre ou lista (RF07).
2. Solicitar coleta: `POST /requests` → valida RN08 → gera `externalReference` → grava `Request` → chama EcoRota → persiste id (RF04, RF05).
3. Acompanhar: Socket.IO (room do morador) + polling 5 s de fallback; tradução de status vinda de `packages/shared` (RF06).
4. Cancelar: `POST /requests/:id/cancel` com confirmação dupla (RN01) e janela de 2 h (RN02).
5. Histórico e engajamento: `GET /me/requests` + `GET /me/rewards`; crédito de pontos **somente no listener de `request.completed`** (RN03).
6. Feedback visual (confete/animação) nas ações de sucesso.

**Critério de aceite:** morador consegue achar ponto, solicitar, acompanhar até concluído, cancelar e ver pontos/badges — sem nenhuma chamada direta do browser à EcoRota.

---

## Fase 6 — Área do coletor (RF08–RF11)

**O que fazer:**
1. Login COLETOR vinculado a `CollectorProfile` (id EcoRota do custom) e painel do dia `GET /collector/requests`.
2. Disponibilidade: `POST /collector/availability` → `EcoRotaClient.updateCollector` (RN05).
3. Detalhe da coleta (RF09): ponto do `OperationState` + material.
4. Confirmar: `POST /collector/requests/:id/complete` validando `custom` + `in_service` (RF10); Cancelar no fluxo (RF11).
5. "Morador ausente" (RN06): registrar motivo + oferecer reagendamento.
6. UI acessível (RNF08): textos curtos, ícones, botões grandes — estilo app de entrega/WhatsApp.

**Critério de aceite:** coletor custom cadastrado recebe trabalho, vê no painel, confirma a coleta no ponto e o status aparece como concluído para o morador em tempo (quase) real.

---

## Fase 7 — Dashboard final e fechamento do acesso

**O que fazer:**
1. Remover o dev-mode do dashboard: `DEV_MODE=false` em produção e **guard `ROL_GESTOR`** nas rotas `/dashboard` e `/api/dashboard/*` (usando o RBAC da Fase 4).
2. Demanda×oferta por região + linha do tempo de concluídas (RF18.2, RF18.3) — melhoria se sobrar tempo.

**Critério de aceite:** sem login `GESTOR`, `/dashboard` responde 401; KPIs e mapa continuam < 3 s (RNF03).

---

## Fase 8 — Demo pronta: PWA, deploy e polimento

**O que fazer:**
1. Instalável (manifest + service worker) para testar no celular.
2. Deploy único (Railway/Render) servindo API + bundle web no mesmo domínio (JWT em cookie OK, zero CORS).
3. Reset do cenário pela EJ: ao detectar nova `generation`, recarregar estado sem reenviar pedidos antigos.
4. Revisão final: acessibilidade, estados vazios, erros 429 bem tratados.

**Critério de aceite:** abrir no celular e no desktop, navegar pelos 3 fluxos e ver a operação mover em tempo real em uma chamada só de demo.

---

## Ordem e prioridade

| Fase | Entregável | Quando fazer |
|---|---|---|
| 0 | Ambiente + credencial + `.env` | **Já** (feito) |
| 1 | Monorepo rodando | Semana 1 |
| 2 | Integração EcoRota (WS) | Semana 1–2 (crítico, desbloqueia tudo) |
| 3 | Dashboard como harness (dev-mode) | Semana 2 (valida a integração visualmente) |
| 4 | Login/usuários (RBAC GESTOR incluso) | Semana 2–3 |
| 5 | Área morador | Semana 3 |
| 6 | Área coletor | Semana 3–4 |
| 7 | Dashboard final + guard GESTOR | Semana 4 |
| 8 | PWA + deploy + demo | Semana 4–5 |