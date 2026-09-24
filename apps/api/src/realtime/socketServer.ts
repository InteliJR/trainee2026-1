import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import {
  operationState,
  type OperationStateEvent,
  type OperationStateSnapshot,
} from '../integration/operation-state/index.js';

export type RealtimeEventsMap = {
  'operation:snapshot': (snapshot: OperationStateSnapshot) => void;
  'operation:event': (event: unknown) => void;
};

export interface RealtimeBroker {
  io: SocketIOServer;
  close: () => Promise<void>;
}

export function createRealtimeBroker(app: FastifyInstance): RealtimeBroker {
  const io = new SocketIOServer(app.server, {
    path: '/socket.io',
    cors: {
      origin: process.env.WEB_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    const snapshot = operationState.getSnapshot();
    socket.emit('operation:snapshot', snapshot);

    socket.on('disconnect', () => {
      socket.removeAllListeners();
    });
  });

  const forwardUpdate = (event: OperationStateEvent): void => {
    switch (event.type) {
      case 'operation.snapshot':
        io.emit('operation:snapshot', event.payload);
        break;
      case 'operation.event':
        io.emit('operation:event', event.payload);
        break;
    }
  };

  operationState.onUpdate(forwardUpdate);

  return {
    io,
    close: () => io.close(),
  };
}
