# Planejamento e implementação do WebSocket EcoRota

> **Situação em 24/09/2026:** consumidor, validação, cache, controle de ordem, persistência do cursor e reconexão implementados. A conexão real aguarda a credencial no `.env`.

## 1. O que esta etapa faz

O backend abre uma única conexão com a EcoRota e mantém em memória uma cópia atualizada da operação:

```text
EcoRota WebSocket
    -> validação da mensagem
    -> controle de generation/revision/id
    -> OperationState
    -> futuras telas e Socket.IO
```

Com isso, cada navegador não precisa se conectar à EcoRota nem receber a credencial externa.

## 2. Protocolo oficial aplicado

- endpoint: `wss://HOST/v1/stream`;
- credencial no cabeçalho `Authorization: Bearer` durante o handshake;
- primeira mensagem: snapshot integral;
- snapshots posteriores também substituem todo o cache;
- eventos diferentes podem compartilhar a mesma `revision`;
- duplicidade é verificada pelo `id` do evento;
- eventos de revisão menor são descartados;
- geração maior aguarda um novo snapshot;
- nenhuma mensagem de aplicação é enviada ao servidor;
- reconexão usa backoff exponencial com jitter e teto de 30 segundos.

## 3. Componentes implementados

| Componente | Função |
|---|---|
| `EcoRotaWsConsumer` | Abre, acompanha, reconecta e encerra a conexão. |
| `streamMessage` | Faz parse e rejeita mensagens fora do contrato. |
| `OperationStateStore` | Mantém pontos, coletores, rotas, solicitações e situação da simulação. |
| `PrismaSystemStateRepository` | Persiste a última `generation`, `revision` e data do snapshot. |
| `GET /api/v1/operacao/integracao` | Permite ao operador inspecionar conexão e quantidade de objetos no cache. |

## 4. Comportamento sem credencial

Sem `ECOROTA_URL` e `ECOROTA_KEY`, o consumidor não é criado. A API, o Supabase e o fluxo local continuam funcionando, enquanto a rota operacional informa `NAO_CONFIGURADA`.

## 5. Como ativar

```dotenv
ECOROTA_URL=https://ecorota.marcusvalente.dev.br
ECOROTA_KEY=<credencial-da-equipe>
```

Depois de reiniciar a API, consultar com o usuário operador:

```http
GET /api/v1/operacao/integracao
x-usuario-id: 33333333-3333-4333-8333-333333333333
```

## 6. Sincronização de domínio concluída

Os eventos agora localizam `CollectionRequest`, atualizam status e coletor, registram histórico `ECOROTA` e concedem pontos de forma idempotente. Snapshots também reconciliam mudanças perdidas.

A próxima etapa é expor pontos de coleta e coletores disponíveis por endpoints de leitura e, depois, encaminhar os deltas para o Socket.IO das telas autorizadas.
