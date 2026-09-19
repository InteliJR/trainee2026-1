# Roteiro de Implementação Emergencial (1,5 Semana / 10 Dias) — EcoRota

Plano em fases para sair do zero à demo final em **10 dias corridos**. Cada fase tem entregáveis diretos, divisão por integrantes do time e dependências explícitas.

---

# 📂 Estrutura do Monorepo e Mapeamento de Responsabilidades

```
trainee2026-1/
├── .env                          # Credencial EcoRota (ECOROTA_KEY) e DATABASE_URL
├── .env.example                  # Template seguro para o time copiar
├── docker-compose.yml            # Banco PostgreSQL 16 local (dev)
├── package.json / pnpm-workspace # Workspace raiz pnpm
├── documents/
│   ├── PLANO.md                  # Roteiro oficial de execução (este documento)
│   ├── arquitetura-Luiz.md       # Decisões de arquitetura e fluxo de camadas
│   └── docs_mafe                 # Requisitos funcionais (RF/RN/RNF) do projeto
│
├── packages/
│   └── shared/                   # 🤝 COMPARTILHADO (Usado por API e Web)
│       └── src/
│           ├── types/ecorota.ts  # Interfaces de Ponto, Coletor, Solicitação e Eventos WS
│           ├── status.ts         # Tradução técnico → amigável ("pending" → "Aguardando coletor")
│           └── index.ts          # Exportações centrais do pacote
│
└── apps/
    ├── api/                      # ⚙️ BACKEND (Dev 1 + Dev 4)
    │   ├── prisma/
    │   │   └── schema.prisma     # Tabela de User, Address, Request e Points (Dev 1)
    │   └── src/
    │       ├── server.ts & app.ts# Bootstrap do Fastify
    │       ├── config/env.ts     # Leitura centralizada de variáveis de ambiente
    │       │
    │       ├── integration/      # ⚙️ DEV 1 (Coração da Integração EcoRota)
    │       │   ├── ecoRotaClient.ts  # Interface do cliente (HTTP / WS / Fake)
    │       │   ├── http/             # REST Proxy (POST /requests, complete, cancel)
    │       │   ├── ws/               # Consumidor WSS com dedup por ID e controle de revision
    │       │   └── operation-state/  # Cache em memória do estado dos pontos e coletores
    │       │
    │       ├── realtime/         # ⚙️ DEV 4 (Broker de Tempo Real)
    │       │   └── socketServer.ts   # Servidor Socket.IO que transmite o OperationState pro front
    │       │
    │       └── modules/          # ⚙️ MÓDULOS DE NEGÓCIO (Dev 1 & Dev 4)
    │           ├── auth/         # Login, Register, Cookies JWT, guards RBAC (Dev 1)
    │           ├── users/        # Perfil e Endereço do Morador (Dev 1)
    │           ├── requests/     # Regras de agendamento e cancelamento (Dev 1 & Dev 4)
    │           ├── collectors/   # Regras de disponibilidade do coletor custom (Dev 1)
    │           ├── dashboard/    # Rota GET /dashboard/stats pré-computada (Dev 4)
    │           └── gamification/ # Credito de pontos no evento request.completed (Dev 1)
    │
    └── web/                      # 🎨 FRONTEND (Dev 2 + Dev 3 + Dev 4)
        └── src/
            ├── App.tsx           # Roteador principal (/morador, /coletor, /dashboard)
            │
            ├── features/
            │   ├── morador/      # 🎨 DEV 2 (Área do Morador)
            │   │   ├── components/  # Busca de pontos, Form de solicitação, Card de status
            │   │   └── pages/       # Solicitar, Acompanhar, Histórico e Gamificação (Confetes)
            │   │
            │   ├── coletor/      # 🎨 DEV 3 (Área do Coletor - Foco Acessibilidade)
            │   │   ├── components/  # Botões grandes estilo WhatsApp, Card de tarefa do dia
            │   │   └── pages/       # Login simplificado, Painel do dia, Detalhes e Confirmação
            │   │
            │   └── dashboard/    # 🎨 DEV 4 (Dashboard Operacional)
            │       ├── components/  # Cards de KPIs, Tabela de solicitações recentes
            │       └── pages/       # Visão Geral do Dashboard + Integração MapLibre
            │
            ├── map/              # 🎨 DEV 4 (Mapeamento)
            │   └── MapContainer.tsx # Componente MapLibre que desenha os 12 pontos e coletores
            │
            └── lib/              # 🤝 DEV 4
                ├── socketClient.ts  # Conexão Socket.IO com a API
                └── apiClient.ts     # Cliente HTTP (fetch/axios com credenciais)
```

---

# 👥 Divisão Exata de Tasks por Integrante (4 Desenvolvedores)

### 🛠️ Dev 1 — Backend Puro (START IMEDIATO)
> **Foco:** Motor de integração EcoRota, Banco de Dados PostgreSQL (Prisma) e Autenticação.

* [ ] **Task 1.1 (Dias 1–2):** Implementar o consumidor WebSocket da EcoRota em `apps/api/src/integration/ws/`.
  * Tratar recepção do `snapshot` inicial (substituição total).
  * Deduplicar eventos por `id` e descartar atualizações com `revision` inferior.
  * Tratar desconexão com backoff exponencial + aleatoriedade (jitter).
* [ ] **Task 1.2 (Dia 3):** Criar a estrutura `OperationState` em `apps/api/src/integration/operation-state/` para manter os 12 pontos, coletores e rotas salvos em memória.
* [ ] **Task 1.3 (Dias 4–5):** Configurar o Prisma ORM com PostgreSQL em `apps/api/prisma/schema.prisma` e criar as tabelas `User`, `Address`, `Request` e `PointsLog`.
* [ ] **Task 1.4 (Dias 5–6):** Criar os endpoints de Autenticação (`POST /auth/register`, `POST /auth/login`) com JWT em cookies `httpOnly` e middlewares de permissão (RBAC).

---

### 🎨 Dev 2 — Frontend Puro (Morador)
> **Foco:** Experiência do cidadão/morador, solicitações e gamificação.

* [ ] **Task 2.1 (Dias 1–3):** Construir a tela de solicitação de coleta em `apps/web/src/features/morador/` usando **dados mockados**.
  * Formulário para escolher o ponto (entre os 12), tipo de material e data.
* [ ] **Task 2.2 (Dias 4–5):** Construir a tela de acompanhamento de status com visualizador amigável (traduzindo `pending` -> "Aguardando coletor", `in_service` -> "Coletor no local").
* [ ] **Task 2.3 (Dias 6–7):** Criar a página de Histórico + Gamificação (exibindo saldo de pontos, metas do mês e efeito visual de confete ao concluir).
* [ ] **Task 2.4 (Dias 8–9):** Conectar os formulários às chamadas reais da API (`POST /requests`) criadas pelo Dev 1/Dev 4.

---

### 🎨 Dev 3 — Frontend Puro (Coletor)
> **Foco:** Interface de campo com alta acessibilidade para catadores autônomos (RNF08).

* [ ] **Task 3.1 (Dias 1–3):** Criar o layout da Área do Coletor em `apps/web/src/features/coletor/` com **botões grandes, ícones claros e alto contraste**.
* [ ] **Task 3.2 (Dias 4–5):** Desenvolver o **Painel do Dia**: lista de tarefas atribuídas ao coletor logado (usando dados mockados).
* [ ] **Task 3.3 (Dias 6–7):** Implementar o fluxo de **Confirmação de Coleta** (botão de conclusão após o status virar `in_service`) e modal de **Morador Ausente** (registro de motivo + reagendamento).
  * **💡 Suporte Offline (Diferencial RNF02):** Implementar fila local (`offlineQueue` via `LocalStorage`/`IndexedDB`). Se o coletor clicar em confirmar sem sinal de celular, a ação fica salva localmente e é enviada automaticamente assim que a rede voltar (`window.addEventListener('online')`).
* [ ] **Task 3.4 (Dias 8–9):** Conectar a interface às rotas reais de confirmação (`POST /requests/:id/complete`) e toggle de disponibilidade (`POST /collector/availability`).

---

### 👑 Dev 4 — Misto (Backend Realtime + Front Dashboard)
> **Foco:** Dashboard em Tempo Real (MapLibre + Socket.IO) e ponte de comunicação.

* [ ] **Task 4.1 (Dias 1–3 - Front):** Criar o componente de mapa com MapLibre em `apps/web/src/map/MapContainer.tsx`.
  * Plotar os 12 pontos de coleta com coordenadas GeoJSON.
  * Renderizar os coletores no mapa usando posições mockadas.
* [ ] **Task 4.2 (Dias 4–5 - Back):** Configurar o servidor Socket.IO em `apps/api/src/realtime/socketServer.ts`.
  * Escutar as atualizações do `OperationState` (do Dev 1) e emitir os eventos `collector.position_updated` para o frontend.
  * Criar a rota `GET /dashboard/stats` pré-computando KPIs do cache.
* [ ] **Task 4.3 (Dias 6–7 - Front):** Conectar o Dashboard ao Socket.IO real.
  * Fazer os coletores **se moverem ao vivo no mapa** sem dar refresh na página!
  * Tratar coletores com telemetria desatualizada (deixando o marcador transparente no mapa caso o `observedAt` seja antigo).
* [ ] **Task 4.4 (Dias 8–9 - Front/Back):** Montar a tabela de solicitações recentes e conectar os eventos de status no mapa dos moradores.
* [ ] **Task 4.5 (Dia 10 - Integração Total):** Liderar a bateria de testes integrados e realizar o deploy único (Render/Railway).

---

# 🔗 Matriz de Dependências e Desbloqueio

```
[Dev 1: Back WS] ─────────► [Dev 4: Socket.IO] ───────► [Dev 4: Mapa ao Vivo]
      │                         │
      ▼                         ▼
[Dev 1: Auth/DB] ─────────► [Dev 2: Form Morador]
      │                         │
      └────────────────────────► [Dev 3: Painel Coletor]
```

### Regras de Paralelismo:
1. **Frontend não espera o Backend:** Devs 2, 3 e 4 criam todas as telas usando os tipos de `@ecorota/shared` e arquivos `.json` de mock nos primeiros 3 dias.
2. **Dev 1 destrava a Operação:** Assim que o Dev 1 conclui o `OperationState` (Dia 3), Dev 4 conecta o Socket.IO e o mapa ganha vida.
3. **Dev 1 destrava os Formulários:** Assim que o Dev 1 entrega o banco e Auth (Dia 5), Devs 2 e 3 conectam os formulários de solicitação e confirmação.

---

# ⏱️ Cronograma de 10 Dias (1,5 Semana)

| Dia | Backend (Dev 1 & Dev 4) | Front Morador (Dev 2) | Front Coletor (Dev 3) | Front Dashboard (Dev 4) |
|---|---|---|---|---|
| **Dia 1** | Dev 1: Conector WSS EcoRota | Tela Solicitar (Mock) | Layout Botões Grandes | Componente MapLibre + 12 Pontos |
| **Dia 2** | Dev 1: Dedup ID / Revisions | Formulário de Material | Painel do Dia (Mock) | Marcadores de Coletores (Mock) |
| **Dia 3** | Dev 1: Cache `OperationState` | Tela Acompanhar Status | Botão Confirmar/Cancelar | Cards de KPIs (Topo) |
| **Dia 4** | Dev 1: Prisma Schema & DB | Tela de Histórico/Pontos | Modal Morador Ausente | **Dev 4:** Server Socket.IO na API |
| **Dia 5** | Dev 1: Rotas de Auth (JWT) | Efeito de Confetes (UI) | Toggle Disponibilidade | **Dev 4:** Rota `GET /dashboard/stats` |
| **Dia 6** | Dev 1: Rotas REST Requests | Conectar Auth no Front | Conectar Auth no Front | **Dev 4:** Conectar Mapa ao Socket.IO |
| **Dia 7** | Listener `request.completed` | Conectar POST Request | Conectar POST Complete | **Dev 4:** Tratar telemetria desatualizada |
| **Dia 8** | Ajustes de Erro / Cota 300 | Testes do Morador | Testes do Coletor | **Dev 4:** Tabela Solicitações Recentes |
| **Dia 9** | **TESTE INTEGRADO GERAL:** Morador solicita ➔ EcoRota atribui ➔ Mapa mexe ➔ Coletor conclui |
| **Dia 10** | **DEPLOY ÚNICO & ENSAIO DA DEMONSTRAÇÃO COM A BANCA** |
