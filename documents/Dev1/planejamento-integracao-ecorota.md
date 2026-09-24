# Planejamento da integração com a EcoRota

> **Situação em 24/09/2026:** contrato `EcoRotaClient`, adaptador HTTP, cliente falso e integração inicial com solicitações implementados. A ativação real aguarda `ECOROTA_URL` e `ECOROTA_KEY` no `.env`.

## 1. Objetivo

Isolar toda comunicação externa em uma única interface para que regras de negócio, rotas e repositórios não dependam de `fetch`, Bearer token ou do formato HTTP da EcoRota.

```text
RequestService
    -> EcoRotaClient
        -> HttpEcoRotaClient (ambiente real)
        -> FakeEcoRotaClient (testes/desenvolvimento)
```

## 2. Contrato oficial confirmado

- URL de documentação: `https://ecorota.marcusvalente.dev.br/docs`;
- autenticação: Bearer token;
- criação: `POST /v1/requests` com `pointId` UUID e `externalReference`;
- cancelamento: `POST /v1/requests/:id/cancel`;
- conclusão custom: `POST /v1/requests/:id/complete`;
- snapshot: `GET /v1/snapshot`;
- limite: 300 chamadas HTTP por minuto;
- WebSocket: opcional, com limite de cinco conexões por ambiente.

## 3. O que foi implementado

| Componente | Responsabilidade |
|---|---|
| `EcoRotaClient` | Contrato independente do transporte para solicitações, snapshot, pontos e coletores. |
| `HttpEcoRotaClient` | Envia Bearer token, aplica timeout, valida o envelope e converte falhas externas em erros estáveis. |
| `FakeEcoRotaClient` | Simula operações sem consumir cota ou alterar o ambiente real. |
| `RequestService` | Envia novas solicitações quando a integração está configurada e persiste o vínculo externo. |
| `CollectionRequest.syncStatus` | Diferencia solicitação pendente, sincronizada e com erro. |

Quando as variáveis externas não existem, o fluxo local continua funcionando e mantém `syncStatus=PENDING`. Quando existem, o servidor instancia o adaptador HTTP automaticamente.

## 4. Comportamento de consistência

### Criação

1. validar regras locais;
2. persistir solicitação, materiais e histórico;
3. enviar `pointId` e `externalReference` à EcoRota;
4. salvar `ecoRotaRequestId` e marcar `SYNCED`;
5. se a EcoRota falhar, preservar a solicitação e marcar `ERROR` para futura retentativa.

### Cancelamento

Quando existe identificador externo, confirmar primeiro na EcoRota. Uma falha retorna `502`, marca erro de sincronização e não cancela silenciosamente apenas de um lado.

### Conclusão

Quando existe identificador externo, a EcoRota precisa confirmar a conclusão antes da atualização local e da concessão dos pontos. Isso preserva a RN03.

## 5. Como ativar

Adicionar ao `.env` da raiz, sem commitar a credencial:

```dotenv
ECOROTA_URL=https://ecorota.marcusvalente.dev.br
ECOROTA_KEY=<credencial-da-equipe>
```

Sem essas duas variáveis, nenhuma chamada externa é realizada.

## 6. Etapa WebSocket concluída

O consumidor WebSocket, snapshot, deduplicação, `generation`, `revision`, persistência do cursor e reconexão foram implementados. Os detalhes estão em `planejamento-websocket-ecorota.md`.

A próxima etapa é sincronizar os eventos recebidos com `CollectionRequest`, `RequestStatusHistory`, perfis de coletores e pontuação persistidos no Supabase.
