# Planejamento da conexão Socket.IO

## Objetivo

Repassar ao React as atualizações recebidas pelo backend no WebSocket da EcoRota sem expor a credencial externa e sem permitir que um usuário veja solicitações de outro.

## Fluxo implementado

```text
EcoRota WebSocket
  -> EcoRotaWsConsumer
  -> OperationState
  -> Socket.IO /tempo-real
  -> salas por papel e usuário
  -> cliente React
```

O Socket.IO compartilha o mesmo servidor HTTP do Fastify. O navegador se conecta ao namespace `/tempo-real`, usando o caminho `/socket.io`.

## Autenticação do handshake

O navegador envia automaticamente o cookie `ecorota_sessao` criado pelo login. A API valida assinatura, expiração, emissor e público do JWT e depois consulta o usuário no PostgreSQL para confirmar o papel e o vínculo do coletor. O objeto `auth` do cliente não é usado como identidade.

## Salas e privacidade

- `usuario:<uuid>`: eventos particulares do morador ou coletor;
- `papel:OPERADOR`: visão operacional completa;
- snapshots do morador contêm somente solicitações próprias;
- snapshots do coletor contêm somente solicitações e rota atribuídas a ele;
- eventos de solicitação são enviados ao morador, ao coletor responsável e aos operadores;
- posição do coletor é enviada aos operadores, ao próprio coletor e a moradores com coleta ativa ligada a ele.

## Eventos públicos

- `operacao:estado-inicial`;
- `operacao:estado-atualizado`;
- `operacao:evento`;
- `coletor:posicao-atualizada`;
- `rota:atualizada`;
- `solicitacao:atribuida`;
- `solicitacao:status-atualizado`;
- `solicitacao:concluida`.

## Uso no frontend

```ts
const socket = createRealtimeClient({});

socket.on('coletor:posicao-atualizada', (evento) => {
  // Atualizar o marcador no MapLibre.
});

socket.connect();
```

Ao desmontar a tela, ela deve remover seus listeners e chamar `socket.disconnect()`.

## Situação atual e próxima etapa

O dashboard já usa `useTempoReal` para conectar esse cliente autenticado ao mapa MapLibre, substituir os mocks por snapshots autorizados, mover coletores e sinalizar telemetria antiga. O próximo incremento visual é desenhar as geometrias de rota e montar a tabela de solicitações recentes.
