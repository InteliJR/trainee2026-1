# Planejamento e implementação da sincronização de domínio

> **Situação em 24/09/2026:** eventos e snapshots da EcoRota já atualizam as solicitações, o histórico e os pontos no Supabase. Verificação integrada concluída.

## 1. Objetivo

Transformar as mensagens recebidas pelo WebSocket em alterações consistentes no banco:

```text
request.assigned / started / completed / cancelled
    -> localizar pela externalReference ou ID EcoRota
    -> atualizar CollectionRequest
    -> criar RequestStatusHistory
    -> conceder pontos somente se concluída
```

## 2. Regras aplicadas

- `externalEventId` identifica cada evento e impede processamento duplicado;
- eventos diferentes podem compartilhar `generation` e `revision`;
- o histórico usa `source=ECOROTA`;
- o ID da solicitação, ponto e coletor externos são atualizados;
- o perfil local do coletor é associado quando existe correspondência por `ecoRotaCollectorId`;
- conclusão gera 100 pontos para o morador e, quando identificado, 100 para o coletor;
- a restrição `(userId, requestId)` impede crédito duplicado;
- solicitações criadas diretamente no ambiente EcoRota e sem correspondência local são ignoradas;
- snapshots reconciliam mudanças perdidas durante uma desconexão.

## 3. Alteração de banco

A migration `20260924000000_allow_shared_event_revision` removeu a unicidade incorreta de `(generation, revision)` e criou um índice comum. A unicidade de `externalEventId` foi mantida.

Essa alteração é necessária porque o contrato oficial permite eventos diferentes na mesma revisão.

## 4. Componentes

| Componente | Responsabilidade |
|---|---|
| `EcoRotaDomainSynchronizer` | Filtra eventos relevantes e reconcilia snapshots. |
| `PrismaEcoRotaRequestSyncRepository` | Atualiza solicitação, histórico e pontos na mesma transação. |
| `EcoRotaWsConsumer` | Chama o sincronizador antes de persistir o cursor processado. |
| `verify-domain-sync.ts` | Executa a jornada simulada diretamente contra o Supabase. |

## 5. Como verificar

```bash
corepack pnpm --filter @ecorota/api sync:verify
```

O verificador confirma:

- transições `PENDING -> ASSIGNED -> IN_SERVICE -> COMPLETED`;
- dois eventos diferentes usando a mesma revisão;
- histórico com origem EcoRota;
- pontos do morador e coletor;
- repetição da conclusão sem duplicar efeitos.

## 6. Consultas operacionais concluídas

Os endpoints de pontos, detalhe e coletores disponíveis foram implementados com filtro geográfico e indicação de dados desatualizados. Os detalhes estão em `planejamento-estado-operacional.md`.

A próxima etapa é implementar as rotas de solicitações e disponibilidade específicas do coletor.
