// Importa apenas o tipo da aplicação Fastify que fornece o servidor HTTP compartilhado com o Socket.IO.
import type { FastifyInstance } from 'fastify';
// Importa o servidor Socket.IO e os tipos usados para representar namespace e conexões individuais.
import { Server as SocketIOServer, type Namespace, type Socket } from 'socket.io';
// Importa o parser de Cookie usado para extrair a sessão do handshake HTTP.
import { parse as parseCookie } from 'cookie';
// Importa o verificador JWT e o nome único do cookie de sessão.
import { AuthTokenService, SESSION_COOKIE_NAME } from '../auth/authToken.js';
// Importa os contratos dos eventos, solicitações e rotas recebidos da plataforma EcoRota.
import type { EcoRotaEventMessage, EcoRotaRequest, EcoRotaRoute } from '../integration/ecorotaClient.js';
// Importa o cache operacional compartilhado e os tipos emitidos quando esse cache muda.
import {
  // Usa a instância global no servidor real quando nenhuma instância alternativa for informada.
  operationState,
  // Tipifica a união entre atualização integral de snapshot e evento incremental.
  type OperationStateEvent,
  // Tipifica o estado operacional completo que pode ser enviado ao navegador.
  type OperationStateSnapshot,
  // Permite injetar um cache isolado durante os testes automatizados.
  type OperationStateStore,
} from '../integration/operation-state/index.js';
// Importa os contratos que consultam no banco quem pode receber cada informação.
import type { RealtimeAccessRepository, RealtimeActor } from './realtimeAccess.repository.js';

// Agrupa os tipos externos que carregam uma solicitação completa dentro do campo data.
const REQUEST_EVENT_TYPES = new Set([
  // Informa que uma solicitação apareceu na EcoRota.
  'request.created',
  // Informa que uma solicitação recebeu um coletor.
  'request.assigned',
  // Informa que o coletor iniciou o atendimento.
  'request.started',
  // Informa que a coleta foi concluída.
  'request.completed',
  // Informa que a solicitação foi cancelada.
  'request.cancelled',
  // Informa que a solicitação voltou para a fila de atendimento.
  'request.requeued',
]);

// Declara os eventos enviados diretamente por uma conexão durante a entrega de snapshots.
interface ServerToClientEvents {
  // Entrega o estado inicial filtrado logo depois que a conexão é autorizada.
  'operacao:estado-inicial': (snapshot: OperationStateSnapshot) => void;
  // Entrega um novo estado filtrado quando a EcoRota envia um snapshot integral.
  'operacao:estado-atualizado': (snapshot: OperationStateSnapshot) => void;
}

// Especializa o Socket.IO para garantir que cada conexão autorizada possua um ator confirmado no banco.
type RealtimeSocket = Socket<
  // O navegador não envia eventos de negócio por este canal; ele apenas recebe atualizações.
  Record<string, never>,
  // Define os eventos tipados que o backend pode emitir diretamente para esta conexão.
  ServerToClientEvents,
  // Este projeto não usa comunicação entre múltiplos servidores Socket.IO neste MVP.
  Record<string, never>,
  // Armazena a identidade confirmada no campo data durante o middleware de handshake.
  { actor: RealtimeActor }
>;

// Agrupa as dependências necessárias para criar o servidor de tempo real.
export interface RealtimeBrokerOptions {
  // Define exatamente qual origem web pode fazer handshake via CORS.
  webOrigin: string;
  // Valida no handshake o mesmo JWT emitido pelas rotas de login.
  tokenService: AuthTokenService;
  // Fornece consultas de identidade, vínculo e autorização sem acoplar o servidor diretamente ao Prisma.
  accessRepository: RealtimeAccessRepository;
  // Permite substituir o cache global por um cache isolado em testes.
  state?: OperationStateStore;
}

// Expõe os recursos necessários para observar e encerrar a integração Socket.IO.
export interface RealtimeBroker {
  // Mantém a instância principal anexada ao servidor HTTP do Fastify.
  io: SocketIOServer;
  // Expõe somente o namespace /tempo-real usado pela aplicação.
  namespace: Namespace;
  // Encerra listeners e conexões de forma controlada durante o shutdown da API.
  close: () => Promise<void>;
}

// Remove do snapshot qualquer solicitação ou rota que o ator não pode visualizar.
export function filterSnapshotForActor(
  // Recebe uma cópia do estado operacional atual mantido em memória.
  snapshot: OperationStateSnapshot,
  // Recebe a identidade e o papel que foram confirmados no banco.
  actor: RealtimeActor,
  // Recebe as referências externas autorizadas em uma estrutura de busca rápida.
  allowedReferences: ReadonlySet<string>,
): OperationStateSnapshot {
  // Operadores precisam do panorama completo para acompanhar a operação.
  if (actor.role === 'OPERADOR') return snapshot;

  // Cria um novo objeto para não alterar o cache compartilhado entre todas as conexões.
  return {
    // Preserva metadados, pontos e coletores necessários para exibir o mapa.
    ...snapshot,
    // Mantém somente solicitações cuja referência pertence ou está atribuída ao usuário.
    requests: snapshot.requests.filter((request) => allowedReferences.has(request.externalReference)),
    // Coletores recebem apenas a própria rota; moradores não recebem detalhes de rota operacional.
    routes: actor.role === 'COLETOR' && actor.ecoRotaCollectorId
      // Compara o vínculo externo do perfil com o coletor indicado em cada rota.
      ? snapshot.routes.filter((route) => route.collectorId === actor.ecoRotaCollectorId)
      // Usa uma lista vazia quando o ator é morador ou ainda não possui vínculo externo.
      : [],
  };
}

// Cria o servidor Socket.IO, registra a autorização e conecta o cache aos eventos públicos.
export function createRealtimeBroker(
  // Recebe a aplicação para compartilhar o mesmo servidor e a mesma porta HTTP do Fastify.
  app: FastifyInstance,
  // Recebe ambiente, origem permitida, repositório e cache operacional.
  options: RealtimeBrokerOptions,
): RealtimeBroker {
  // Usa o cache injetado quando existe e recorre à instância global no servidor real.
  const state = options.state ?? operationState;
  // Anexa uma nova instância Socket.IO ao servidor HTTP já criado pelo Fastify.
  const io = new SocketIOServer(app.server, {
    // Mantém o endpoint técnico padrão separado do namespace lógico da aplicação.
    path: '/socket.io',
    // Restringe os handshakes iniciados pelo navegador por meio da política CORS.
    cors: {
      // Aceita apenas a URL do frontend validada nas variáveis de ambiente.
      origin: options.webOrigin,
      // Libera os métodos usados pelos transportes WebSocket e long polling do Socket.IO.
      methods: ['GET', 'POST'],
      // Permite que o navegador envie o cookie httpOnly criado no login.
      credentials: true,
    },
  });
  // Isola todos os eventos do projeto dentro do endereço lógico /tempo-real.
  const namespace = io.of('/tempo-real');

  // Executa este middleware antes de aceitar cada conexão no namespace.
  namespace.use(async (socket, next) => {
    // Faz parse do cabeçalho sem confiar em dados enviados no objeto auth do cliente.
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    // Extrai somente o cookie padronizado pelas rotas de autenticação.
    const token = cookies[SESSION_COOKIE_NAME];
    // Rejeita conexão anônima antes de qualquer consulta ao banco.
    if (!token) return next(new Error('SESSAO_NAO_AUTENTICADA'));

    // Separa falha esperada de token de uma indisponibilidade inesperada do banco.
    let tokenActor: Awaited<ReturnType<AuthTokenService['verify']>>;
    // Valida assinatura, expiração, emissor e público do JWT.
    try {
      tokenActor = await options.tokenService.verify(token);
    } catch {
      // Devolve um código estável sem revelar por que o JWT falhou.
      return next(new Error('SESSAO_INVALIDA'));
    }

    // Protege o handshake contra indisponibilidade ou erro inesperado do banco.
    try {
      // Consulta o usuário para confirmar existência, papel e eventual vínculo de coletor.
      const actor = await options.accessRepository.findActor(tokenActor.id);
      // Invalida sessões de usuários removidos ou cujo papel mudou desde o login.
      if (!actor || actor.role !== tokenActor.role) return next(new Error('SESSAO_DESATUALIZADA'));
      // Armazena no socket somente a identidade que acabou de ser confirmada pelo servidor.
      (socket as RealtimeSocket).data.actor = actor;
      // Autoriza a abertura da conexão no namespace /tempo-real.
      next();
    } catch (error) {
      // Registra o erro original apenas no backend para permitir diagnóstico operacional.
      app.log.error({ err: error }, 'Falha ao validar a conexão Socket.IO.');
      // Envia ao navegador um código genérico que não expõe detalhes internos do banco.
      next(new Error('FALHA_AO_VALIDAR_IDENTIDADE'));
    }
  });

  // Executa esta rotina somente depois que o middleware autorizou a conexão.
  namespace.on('connection', async (rawSocket) => {
    // Converte o socket genérico no tipo que garante a presença do ator validado.
    const socket = rawSocket as RealtimeSocket;
    // Recupera a identidade salva pelo middleware do handshake.
    const actor = socket.data.actor;
    // Inscreve a conexão simultaneamente na sala coletiva do papel e na sala privada do usuário.
    await socket.join([roleRoom(actor.role), userRoom(actor.id)]);

    // Protege a montagem do snapshot contra falhas na consulta de permissões.
    try {
      // Busca no banco as solicitações que o usuário pode visualizar neste momento.
      const allowed = await options.accessRepository.listAllowedExternalReferences(actor);
      // Envia o primeiro estado para que a tela seja preenchida sem aguardar o próximo evento externo.
      socket.emit(
        // Usa um nome público em português para padronizar o contrato com o frontend.
        'operacao:estado-inicial',
        // Filtra o cache atual antes de expor qualquer solicitação ou rota ao navegador.
        filterSnapshotForActor(state.getSnapshot(), actor, new Set(allowed)),
      );
    } catch (error) {
      // Registra qual usuário não teve o estado inicial montado, sem enviar detalhes ao cliente.
      app.log.error({ err: error, userId: actor.id }, 'Falha ao montar estado inicial do Socket.IO.');
      // Fecha a conexão porque não é seguro mantê-la sem conseguir calcular suas permissões.
      socket.disconnect(true);
    }
  });

  // Adapta o callback síncrono do cache para iniciar o encaminhamento assíncrono dos eventos.
  const forwardUpdate = (event: OperationStateEvent): void => {
    // Inicia a distribuição sem bloquear o consumidor WebSocket da EcoRota.
    void forwardOperationUpdate(namespace, event, options.accessRepository, app, state);
  };
  // Registra o callback e guarda a função que removerá o listener no encerramento.
  const unsubscribe = state.onUpdate(forwardUpdate);

  // Devolve as referências usadas pelo bootstrap, pelos testes e pelo shutdown.
  return {
    // Expõe o servidor principal para inspeção quando necessário.
    io,
    // Expõe o namespace específico sem misturá-lo a outros namespaces Socket.IO.
    namespace,
    // Define o encerramento assíncrono e idempotente da camada de tempo real.
    close: async () => {
      // Remove o listener do cache para impedir emissões depois do shutdown.
      unsubscribe();
      // Desconecta todos os navegadores ligados especificamente ao namespace da aplicação.
      namespace.disconnectSockets(true);
      // Encerra os transportes WebSocket e polling administrados pelo Engine.IO.
      io.engine.close();
    },
  };
}

// Decide como uma alteração do cache será filtrada e distribuída entre as salas autorizadas.
async function forwardOperationUpdate(
  // Recebe o namespace onde estão as conexões autorizadas.
  namespace: Namespace,
  // Recebe um snapshot integral ou um evento incremental aplicado ao cache.
  event: OperationStateEvent,
  // Recebe as consultas de autorização necessárias para selecionar destinatários.
  repository: RealtimeAccessRepository,
  // Recebe o Fastify para registrar erros no logger central da API.
  app: FastifyInstance,
  // Recebe o cache para incluir a geração atual nos logs de falha.
  state: OperationStateStore,
): Promise<void> {
  // Evita que uma falha de distribuição interrompa o processamento da integração EcoRota.
  try {
    // Trata snapshots de forma diferente porque cada conexão precisa de uma versão personalizada.
    if (event.type === 'operation.snapshot') {
      // Aguarda a filtragem de todas as conexões antes de concluir esta distribuição.
      await Promise.all([...namespace.sockets.values()].map(async (rawSocket) => {
        // Converte a conexão para recuperar o ator salvo no handshake.
        const socket = rawSocket as RealtimeSocket;
        // Lê a identidade confirmada que define o filtro desta conexão.
        const actor = socket.data.actor;
        // Atualiza as permissões a cada snapshot para refletir novas atribuições feitas no banco.
        const allowed = await repository.listAllowedExternalReferences(actor);
        // Envia a cada conexão somente a versão do snapshot compatível com seu papel e seus vínculos.
        socket.emit('operacao:estado-atualizado', filterSnapshotForActor(event.payload, actor, new Set(allowed)));
      }));
      // Encerra o tratamento porque um snapshot não deve cair nas regras de eventos incrementais.
      return;
    }

    // Extrai a mensagem original da EcoRota contida no evento incremental do cache.
    const message = event.payload;
    // Verifica se a mensagem carrega uma solicitação de coleta.
    if (REQUEST_EVENT_TYPES.has(message.type)) {
      // Distribui a solicitação apenas ao morador, ao coletor responsável e aos operadores.
      await emitRequestEvent(namespace, message, repository);
      // Impede que a mesma mensagem seja emitida também como evento operacional genérico.
      return;
    }
    // Verifica se a EcoRota informou uma nova posição de coletor.
    if (message.type === 'collector.position_updated') {
      // Distribui a posição somente a pessoas relacionadas ao coletor e à operação.
      await emitCollectorPosition(namespace, message, repository);
      // Finaliza porque a mensagem já recebeu seu contrato público específico.
      return;
    }
    // Verifica se a rota calculada para um coletor mudou.
    if (message.type === 'route.updated') {
      // Entrega a rota somente ao coletor correspondente e aos operadores.
      await emitRouteUpdate(namespace, message, repository);
      // Finaliza porque a rota já foi encaminhada aos destinatários corretos.
      return;
    }

    // Reserva eventos administrativos de coletor e simulação à sala dos operadores.
    namespace.to(roleRoom('OPERADOR')).emit('operacao:evento', translateEvent(message));
  } catch (error) {
    // Registra contexto suficiente para diagnosticar a emissão sem derrubar a conexão externa.
    app.log.error(
      // Inclui o erro, a geração atual e a categoria interna do evento que falhou.
      { err: error, generation: state.getSnapshot().generation, eventType: event.type },
      // Usa uma mensagem estável para facilitar buscas nos logs.
      'Falha ao encaminhar atualização pelo Socket.IO.',
    );
  }
}

// Encaminha uma mudança de solicitação para todos os usuários diretamente relacionados.
async function emitRequestEvent(
  // Recebe o namespace utilizado para selecionar múltiplas salas de uma só vez.
  namespace: Namespace,
  // Recebe a mensagem externa com metadados de versão e a solicitação no campo data.
  message: EcoRotaEventMessage,
  // Recebe as consultas que resolvem referências externas em usuários locais.
  repository: RealtimeAccessRepository,
): Promise<void> {
  // Interpreta data como solicitação porque o chamador já validou o tipo do evento.
  const request = message.data as EcoRotaRequest;
  // Resolve em paralelo os destinatários locais e o usuário ligado ao coletor externo mais recente.
  const [recipients, externalCollectorUserId] = await Promise.all([
    // Procura morador e coletor pelo vínculo persistido da solicitação.
    repository.findRequestRecipients(request.externalReference),
    // Procura também pelo collectorId do próprio evento para cobrir uma atribuição que acabou de chegar.
    request.collectorId ? repository.findCollectorUserId(request.collectorId) : Promise.resolve(null),
  ]);
  // Sempre inclui a sala dos operadores para manter o painel operacional atualizado.
  const rooms = new Set([roleRoom('OPERADOR')]);
  // Só adiciona salas particulares quando a referência externa existe no domínio local.
  if (recipients) {
    // Inclui o morador proprietário da solicitação.
    rooms.add(userRoom(recipients.residentUserId));
    // Inclui o coletor persistido quando a solicitação já está vinculada a um perfil.
    if (recipients.collectorUserId) rooms.add(userRoom(recipients.collectorUserId));
  }
  // Inclui o coletor indicado no evento mesmo que a sincronização no banco ainda esteja terminando.
  if (externalCollectorUserId) rooms.add(userRoom(externalCollectorUserId));
  // Escolhe um nome mais específico para os dois marcos relevantes da interface.
  const eventName = message.type === 'request.assigned'
    // Permite à tela destacar imediatamente uma nova atribuição.
    ? 'solicitacao:atribuida'
    // Verifica separadamente se o fluxo chegou à conclusão.
    : message.type === 'request.completed'
      // Permite à tela disparar o tratamento visual de coleta concluída.
      ? 'solicitacao:concluida'
      // Usa um evento geral para criação, início, cancelamento e retorno à fila.
      : 'solicitacao:status-atualizado';
  // Emite uma única vez para a união das salas; o Set evita nomes repetidos.
  namespace.to([...rooms]).emit(eventName, translateRequestEvent(message, request));
}

// Encaminha uma posição de coletor somente a quem precisa acompanhá-la no mapa.
async function emitCollectorPosition(
  // Recebe o namespace onde as salas de usuário e operador foram criadas.
  namespace: Namespace,
  // Recebe o evento externo com posição e metadados de ordenação.
  message: EcoRotaEventMessage,
  // Recebe consultas para localizar o coletor local e moradores com atendimento ativo.
  repository: RealtimeAccessRepository,
): Promise<void> {
  // Interpreta somente os campos garantidos pelo evento collector.position_updated.
  const collector = message.data as { id: string; position: unknown; observedAt: string };
  // Executa as duas consultas independentes em paralelo para reduzir a latência da emissão.
  const [collectorUserId, residentUserIds] = await Promise.all([
    // Resolve a sala privada do próprio coletor.
    repository.findCollectorUserId(collector.id),
    // Resolve moradores que possuem coleta ativa com esse coletor.
    repository.listResidentUserIds(collector.id),
  ]);
  // O painel do operador sempre recebe posições para montar a visão completa do mapa.
  const rooms = new Set([roleRoom('OPERADOR')]);
  // Inclui o próprio coletor quando há vínculo entre EcoRota e usuário local.
  if (collectorUserId) rooms.add(userRoom(collectorUserId));
  // Inclui individualmente cada morador relacionado, sem expor a posição a outros moradores.
  for (const userId of residentUserIds) rooms.add(userRoom(userId));
  // Publica um contrato em português com somente os dados necessários para atualizar o marcador.
  namespace.to([...rooms]).emit('coletor:posicao-atualizada', {
    // Identifica qual marcador deve ser atualizado.
    coletorExternoId: collector.id,
    // Repassa a geometria de posição fornecida pela EcoRota.
    posicao: collector.position,
    // Informa quando a posição foi observada para a tela calcular defasagem de telemetria.
    observadoEm: collector.observedAt,
    // Permite ao cliente ignorar uma atualização com revisão mais antiga.
    revisao: message.revision,
    // Permite descartar dados pertencentes a uma geração anterior da simulação.
    geracao: message.generation,
  });
}

// Encaminha uma rota atualizada ao coletor correspondente e aos operadores.
async function emitRouteUpdate(
  // Recebe o namespace usado para selecionar as salas de destino.
  namespace: Namespace,
  // Recebe a mensagem externa que contém a rota no campo data.
  message: EcoRotaEventMessage,
  // Recebe a consulta que converte coletor externo em usuário local.
  repository: RealtimeAccessRepository,
): Promise<void> {
  // Interpreta data como rota porque o chamador já confirmou message.type como route.updated.
  const route = message.data as EcoRotaRoute;
  // Procura o usuário local associado ao coletor que recebeu a rota.
  const collectorUserId = await repository.findCollectorUserId(route.collectorId);
  // Inclui operadores para manter a visualização global das rotas.
  const rooms = new Set([roleRoom('OPERADOR')]);
  // Inclui o coletor responsável quando seu vínculo local estiver configurado.
  if (collectorUserId) rooms.add(userRoom(collectorUserId));
  // Publica a rota e os metadados necessários para ordenar atualizações no cliente.
  namespace.to([...rooms]).emit('rota:atualizada', {
    // Identifica o coletor dono da rota.
    coletorExternoId: route.collectorId,
    // Repassa geometria, paradas, distância, duração e revisão específica da rota.
    rota: route,
    // Repassa a revisão global do evento EcoRota.
    revisao: message.revision,
    // Repassa a geração da simulação que produziu a rota.
    geracao: message.generation,
  });
}

// Traduz uma solicitação externa para o contrato público em português usado pelo React.
function translateRequestEvent(message: EcoRotaEventMessage, request: EcoRotaRequest): object {
  // Retorna um novo objeto para não expor diretamente a estrutura recebida da integração externa.
  return {
    // Mantém o identificador técnico atribuído pela EcoRota.
    idExterno: request.id,
    // Mantém a chave que relaciona a solicitação externa ao registro local.
    referenciaExterna: request.externalReference,
    // Identifica o ponto de coleta selecionado.
    pontoColetaExternoId: request.pointId,
    // Identifica o coletor atribuído ou informa null quando ainda não existe atribuição.
    coletorExternoId: request.collectorId,
    // Converte o status técnico em inglês para o vocabulário público da aplicação.
    status: translateStatus(request.status),
    // Informa quando a mudança aconteceu na EcoRota.
    ocorridoEm: message.occurredAt,
    // Permite ordenar eventos dentro da mesma geração.
    revisao: message.revision,
    // Permite detectar reinícios ou reinicializações da simulação.
    geracao: message.generation,
  };
}

// Traduz eventos administrativos sem perder os metadados fornecidos pela EcoRota.
function translateEvent(message: EcoRotaEventMessage): object {
  // Cria o contrato genérico consumido somente pelo painel do operador.
  return {
    // Repassa o identificador único usado para deduplicação.
    id: message.id,
    // Mantém o tipo técnico para o painel decidir como representar o evento.
    tipo: message.type,
    // Repassa os dados específicos porque eventos administrativos possuem formatos diferentes.
    dados: message.data,
    // Informa o momento registrado pela origem.
    ocorridoEm: message.occurredAt,
    // Repassa a revisão usada para ordenação.
    revisao: message.revision,
    // Repassa a geração usada para invalidar estado antigo.
    geracao: message.generation,
  };
}

// Converte os estados da EcoRota para os nomes adotados na API e na interface em português.
function translateStatus(status: EcoRotaRequest['status']): string {
  // Usa um mapa exaustivo para centralizar a tradução de todos os estados externos conhecidos.
  return {
    // Traduz uma solicitação aguardando atendimento.
    pending: 'PENDENTE',
    // Traduz uma solicitação que já possui coletor.
    assigned: 'ATRIBUIDA',
    // Traduz uma coleta que está sendo executada.
    in_service: 'EM_ATENDIMENTO',
    // Traduz uma coleta finalizada.
    completed: 'CONCLUIDA',
    // Traduz uma solicitação cancelada.
    cancelled: 'CANCELADA',
  }[status];
}

// Padroniza o nome da sala compartilhada por todos os usuários de um mesmo papel.
function roleRoom(role: RealtimeActor['role']): string {
  // Prefixa o papel para impedir colisão com salas particulares ou futuras categorias.
  return `papel:${role}`;
}

// Padroniza o nome da sala particular de um usuário autenticado.
function userRoom(userId: string): string {
  // Prefixa o UUID para separar claramente identidade de outras salas do namespace.
  return `usuario:${userId}`;
}
