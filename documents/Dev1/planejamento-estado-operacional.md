# Planejamento e implementação das consultas operacionais

> **Situação em 24/09/2026:** endpoints de pontos de coleta, detalhe do ponto e coletores disponíveis implementados e testados com snapshots simulados.

## 1. Objetivo

Permitir que frontend e mapa consultem o cache mantido pelo WebSocket sem fazer uma chamada à EcoRota para cada usuário.

```text
EcoRota WebSocket -> OperationState -> API Fastify -> frontend
```

## 2. Endpoints

| Método | Endpoint | Resultado |
|---|---|---|
| `GET` | `/api/v1/pontos-coleta` | Lista pontos, coordenadas, circuito e demanda. |
| `GET` | `/api/v1/pontos-coleta/:pontoId` | Mostra o ponto e a quantidade de solicitações ativas. |
| `GET` | `/api/v1/coletores/disponiveis` | Lista somente coletores marcados como disponíveis. |

Todos utilizam temporariamente o cabeçalho `x-usuario-id` enquanto o JWT está adiado.

## 3. Filtro geográfico

As listagens aceitam:

```text
?latitude=-23.5505&longitude=-46.6333&raioKm=10
```

Regras:

- latitude e longitude precisam ser informadas juntas;
- `raioKm` exige coordenadas;
- o raio máximo aceito é 500 km;
- a distância é calculada pela fórmula de Haversine;
- quando há coordenadas, o resultado é ordenado do mais próximo ao mais distante;
- coletores sem posição não aparecem quando existe filtro de raio.

## 4. Dados desatualizados

O backend considera um dado desatualizado quando o tempo desde `observedAt` ultrapassa o maior valor entre:

- 15 segundos;
- três vezes o `pollIntervalMs` informado no snapshot.

Pontos retornam `dadosDesatualizados`. Cada coletor retorna `telemetriaDesatualizada`, porque sua posição possui horário próprio.

## 5. Ausência de snapshot

Antes do primeiro snapshot, os endpoints respondem `503 DADOS_OPERACIONAIS_INDISPONIVEIS`. Isso evita apresentar uma lista vazia como se a EcoRota realmente não tivesse pontos ou coletores.

## 6. Gestão do coletor concluída

As rotas de solicitações e disponibilidade do coletor foram implementadas, incluindo sincronização opcional com `PATCH /v1/collectors/:id`. Os detalhes estão em `planejamento-gestao-coletor.md`.

A próxima etapa é conectar o Socket.IO ao bootstrap da API para distribuir as atualizações às telas.
