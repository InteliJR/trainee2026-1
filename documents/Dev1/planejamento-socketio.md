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

## Identidade provisória

Como a autenticação foi adiada, desenvolvimento e teste enviam `auth.usuarioId` no handshake. A API não confia no papel enviado pelo navegador: ela consulta o usuário no PostgreSQL e obtém o papel e o vínculo do coletor.

Em produção, toda conexão é recusada com `AUTENTICACAO_REAL_NECESSARIA`. Quando a autenticação for implementada, o handshake provisório deverá ser substituído pela validação do JWT em cookie `httpOnly`.

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
const socket = createRealtimeClient({ usuarioId });

socket.on('coletor:posicao-atualizada', (evento) => {
  // Atualizar o marcador no MapLibre.
});

socket.connect();
```

Ao desmontar a tela, ela deve remover seus listeners e chamar `socket.disconnect()`.

## Próxima etapa

Conectar esse cliente às telas e ao mapa MapLibre. Depois, na etapa de autenticação, trocar `auth.usuarioId` pelo JWT em cookie sem alterar os nomes dos eventos nem a lógica das salas.
