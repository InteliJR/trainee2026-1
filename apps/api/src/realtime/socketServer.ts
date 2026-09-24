import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Namespace, type Socket } from 'socket.io';
import type { NodeEnvironment } from '../config/validateEnv.js';
import type { EcoRotaEventMessage, EcoRotaRequest, EcoRotaRoute } from '../integration/ecorotaClient.js';
import {
  operationState,
  type OperationStateEvent,
  type OperationStateSnapshot,
  type OperationStateStore,
} from '../integration/operation-state/index.js';
import type { RealtimeAccessRepository, RealtimeActor } from './realtimeAccess.repository.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_EVENT_TYPES = new Set([
  'request.created',
  'request.assigned',
  'request.started',
  'request.completed',
  'request.cancelled',
  'request.requeued',
]);

interface ServerToClientEvents {
  'operacao:estado-inicial': (snapshot: OperationStateSnapshot) => void;
  'operacao:estado-atualizado': (snapshot: OperationStateSnapshot) => void;
}

type RealtimeSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  { actor: RealtimeActor }
>;

export interface RealtimeBrokerOptions {
  nodeEnv: NodeEnvironment;
  webOrigin: string;
  accessRepository: RealtimeAccessRepository;
  state?: OperationStateStore;
}

export interface RealtimeBroker {
  io: SocketIOServer;
  namespace: Namespace;
  close: () => Promise<void>;
}

export function filterSnapshotForActor(
  snapshot: OperationStateSnapshot,
  actor: RealtimeActor,
  allowedReferences: ReadonlySet<string>,
): OperationStateSnapshot {
  if (actor.role === 'OPERADOR') return snapshot;

  return {
    ...snapshot,
    requests: snapshot.requests.filter((request) => allowedReferences.has(request.externalReference)),
    routes: actor.role === 'COLETOR' && actor.ecoRotaCollectorId
      ? snapshot.routes.filter((route) => route.collectorId === actor.ecoRotaCollectorId)
      : [],
  };
}

export function createRealtimeBroker(
  app: FastifyInstance,
  options: RealtimeBrokerOptions,
): RealtimeBroker {
  const state = options.state ?? operationState;
  const io = new SocketIOServer(app.server, {
    path: '/socket.io',
    cors: {
      origin: options.webOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  const namespace = io.of('/tempo-real');

  namespace.use(async (socket, next) => {
    if (options.nodeEnv === 'production') {
      next(new Error('AUTENTICACAO_REAL_NECESSARIA'));
      return;
    }

    const authUserId = socket.handshake.auth.usuarioId;
    const headerUserId = socket.handshake.headers['x-usuario-id'];
    const userId = typeof authUserId === 'string'
      ? authUserId
      : typeof headerUserId === 'string' ? headerUserId : '';
    if (!UUID_PATTERN.test(userId)) {
      next(new Error('IDENTIDADE_NAO_INFORMADA'));
      return;
    }

    try {
      const actor = await options.accessRepository.findActor(userId);
      if (!actor) {
        next(new Error('USUARIO_NAO_ENCONTRADO'));
        return;
      }
      (socket as RealtimeSocket).data.actor = actor;
      next();
    } catch (error) {
      app.log.error({ err: error }, 'Falha ao validar a conexão Socket.IO.');
      next(new Error('FALHA_AO_VALIDAR_IDENTIDADE'));
    }
  });

  namespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as RealtimeSocket;
    const actor = socket.data.actor;
    await socket.join([roleRoom(actor.role), userRoom(actor.id)]);

    try {
      const allowed = await options.accessRepository.listAllowedExternalReferences(actor);
      socket.emit(
        'operacao:estado-inicial',
        filterSnapshotForActor(state.getSnapshot(), actor, new Set(allowed)),
      );
    } catch (error) {
      app.log.error({ err: error, userId: actor.id }, 'Falha ao montar estado inicial do Socket.IO.');
      socket.disconnect(true);
    }
  });

  const forwardUpdate = (event: OperationStateEvent): void => {
    void forwardOperationUpdate(namespace, event, options.accessRepository, app, state);
  };
  const unsubscribe = state.onUpdate(forwardUpdate);

  return {
    io,
    namespace,
    close: async () => {
      unsubscribe();
      namespace.disconnectSockets(true);
      io.engine.close();
    },
  };
}

async function forwardOperationUpdate(
  namespace: Namespace,
  event: OperationStateEvent,
  repository: RealtimeAccessRepository,
  app: FastifyInstance,
  state: OperationStateStore,
): Promise<void> {
  try {
    if (event.type === 'operation.snapshot') {
      await Promise.all([...namespace.sockets.values()].map(async (rawSocket) => {
        const socket = rawSocket as RealtimeSocket;
        const actor = socket.data.actor;
        const allowed = await repository.listAllowedExternalReferences(actor);
        socket.emit('operacao:estado-atualizado', filterSnapshotForActor(event.payload, actor, new Set(allowed)));
      }));
      return;
    }

    const message = event.payload;
    if (REQUEST_EVENT_TYPES.has(message.type)) {
      await emitRequestEvent(namespace, message, repository);
      return;
    }
    if (message.type === 'collector.position_updated') {
      await emitCollectorPosition(namespace, message, repository);
      return;
    }
    if (message.type === 'route.updated') {
      await emitRouteUpdate(namespace, message, repository);
      return;
    }

    namespace.to(roleRoom('OPERADOR')).emit('operacao:evento', translateEvent(message));
  } catch (error) {
    app.log.error(
      { err: error, generation: state.getSnapshot().generation, eventType: event.type },
      'Falha ao encaminhar atualização pelo Socket.IO.',
    );
  }
}

async function emitRequestEvent(
  namespace: Namespace,
  message: EcoRotaEventMessage,
  repository: RealtimeAccessRepository,
): Promise<void> {
  const request = message.data as EcoRotaRequest;
  const [recipients, externalCollectorUserId] = await Promise.all([
    repository.findRequestRecipients(request.externalReference),
    request.collectorId ? repository.findCollectorUserId(request.collectorId) : Promise.resolve(null),
  ]);
  const rooms = new Set([roleRoom('OPERADOR')]);
  if (recipients) {
    rooms.add(userRoom(recipients.residentUserId));
    if (recipients.collectorUserId) rooms.add(userRoom(recipients.collectorUserId));
  }
  if (externalCollectorUserId) rooms.add(userRoom(externalCollectorUserId));
  const eventName = message.type === 'request.assigned'
    ? 'solicitacao:atribuida'
    : message.type === 'request.completed'
      ? 'solicitacao:concluida'
      : 'solicitacao:status-atualizado';
  namespace.to([...rooms]).emit(eventName, translateRequestEvent(message, request));
}

async function emitCollectorPosition(
  namespace: Namespace,
  message: EcoRotaEventMessage,
  repository: RealtimeAccessRepository,
): Promise<void> {
  const collector = message.data as { id: string; position: unknown; observedAt: string };
  const [collectorUserId, residentUserIds] = await Promise.all([
    repository.findCollectorUserId(collector.id),
    repository.listResidentUserIds(collector.id),
  ]);
  const rooms = new Set([roleRoom('OPERADOR')]);
  if (collectorUserId) rooms.add(userRoom(collectorUserId));
  for (const userId of residentUserIds) rooms.add(userRoom(userId));
  namespace.to([...rooms]).emit('coletor:posicao-atualizada', {
    coletorExternoId: collector.id,
    posicao: collector.position,
    observadoEm: collector.observedAt,
    revisao: message.revision,
    geracao: message.generation,
  });
}

async function emitRouteUpdate(
  namespace: Namespace,
  message: EcoRotaEventMessage,
  repository: RealtimeAccessRepository,
): Promise<void> {
  const route = message.data as EcoRotaRoute;
  const collectorUserId = await repository.findCollectorUserId(route.collectorId);
  const rooms = new Set([roleRoom('OPERADOR')]);
  if (collectorUserId) rooms.add(userRoom(collectorUserId));
  namespace.to([...rooms]).emit('rota:atualizada', {
    coletorExternoId: route.collectorId,
    rota: route,
    revisao: message.revision,
    geracao: message.generation,
  });
}

function translateRequestEvent(message: EcoRotaEventMessage, request: EcoRotaRequest): object {
  return {
    idExterno: request.id,
    referenciaExterna: request.externalReference,
    pontoColetaExternoId: request.pointId,
    coletorExternoId: request.collectorId,
    status: translateStatus(request.status),
    ocorridoEm: message.occurredAt,
    revisao: message.revision,
    geracao: message.generation,
  };
}

function translateEvent(message: EcoRotaEventMessage): object {
  return {
    id: message.id,
    tipo: message.type,
    dados: message.data,
    ocorridoEm: message.occurredAt,
    revisao: message.revision,
    geracao: message.generation,
  };
}

function translateStatus(status: EcoRotaRequest['status']): string {
  return {
    pending: 'PENDENTE',
    assigned: 'ATRIBUIDA',
    in_service: 'EM_ATENDIMENTO',
    completed: 'CONCLUIDA',
    cancelled: 'CANCELADA',
  }[status];
}

function roleRoom(role: RealtimeActor['role']): string {
  return `papel:${role}`;
}

function userRoom(userId: string): string {
  return `usuario:${userId}`;
}
