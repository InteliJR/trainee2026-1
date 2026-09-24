import WebSocket, { type ClientOptions, type RawData } from 'ws';
import type { OperationStateStore } from '../operation-state/operationState.js';
import type { EcoRotaEventMessage, EcoRotaSnapshot } from '../ecorotaClient.js';
import { parseEcoRotaStreamMessage } from './streamMessage.js';
import type { SystemStateRepository } from './systemState.repository.js';

export type StreamConnectionStatus = 'stopped' | 'connecting' | 'connected' | 'waiting_retry' | 'authentication_error';

export interface StreamStatus {
  connection: StreamConnectionStatus;
  reconnectAttempt: number;
  lastMessageAt: string | null;
  lastError: string | null;
}

interface StreamLogger {
  info(data: object, message: string): void;
  warn(data: object, message: string): void;
  error(data: object, message: string): void;
}

interface EcoRotaWsConsumerOptions {
  baseUrl: string;
  apiKey: string;
  operationState: OperationStateStore;
  systemStateRepository: SystemStateRepository;
  logger: StreamLogger;
  baseRetryMs?: number;
  maxRetryMs?: number;
  jitterMs?: number;
  random?: () => number;
  createSocket?: (url: string, options: ClientOptions) => WebSocket;
  onSnapshot?: (snapshot: EcoRotaSnapshot) => Promise<void>;
  onEvent?: (event: EcoRotaEventMessage) => Promise<void>;
}

export function toWebSocketUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/stream`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function calculateReconnectDelay(
  attempt: number,
  randomValue: number,
  baseRetryMs = 1_000,
  maxRetryMs = 30_000,
  jitterMs = 500,
): number {
  return Math.min(maxRetryMs, baseRetryMs * 2 ** attempt) + Math.floor(randomValue * jitterMs);
}

export class EcoRotaWsConsumer {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = true;
  private processing = Promise.resolve();
  private status: StreamStatus = {
    connection: 'stopped',
    reconnectAttempt: 0,
    lastMessageAt: null,
    lastError: null,
  };

  constructor(private readonly options: EcoRotaWsConsumerOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.status.connection = 'stopped';
    this.socket?.close(1000, 'Encerramento da API');
    this.socket = null;
    await this.processing;
  }

  getStatus(): StreamStatus {
    return { ...this.status };
  }

  private connect(): void {
    if (this.stopped) return;
    this.status.connection = 'connecting';
    const createSocket = this.options.createSocket ?? ((url, options) => new WebSocket(url, options));
    const socket = createSocket(toWebSocketUrl(this.options.baseUrl), {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    this.socket = socket;

    socket.on('open', () => {
      this.options.logger.info({}, 'Conexão WebSocket com a EcoRota aberta; aguardando snapshot.');
    });
    socket.on('message', (raw: RawData) => {
      this.processing = this.processing
        .then(() => this.processMessage(raw.toString()))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Erro desconhecido no stream.';
          this.status.lastError = message;
          this.options.logger.error({ err: message }, 'Falha ao processar mensagem WebSocket da EcoRota.');
        });
    });
    socket.on('error', (error) => {
      this.status.lastError = error.message;
      this.options.logger.warn({ err: error.message }, 'Erro na conexão WebSocket da EcoRota.');
    });
    socket.on('close', (code) => {
      this.socket = null;
      if (this.stopped) return;
      if (code === 1008 || code === 4001 || code === 4003) {
        this.stopped = true;
        this.status.connection = 'authentication_error';
        this.status.lastError = 'A EcoRota recusou ou revogou a credencial.';
        this.options.logger.error({ code }, 'Reconexão EcoRota interrompida por falha de credencial.');
        return;
      }
      this.scheduleReconnect(code);
    });
  }

  private async processMessage(raw: string): Promise<void> {
    const message = parseEcoRotaStreamMessage(raw);
    this.status.lastMessageAt = new Date().toISOString();

    if (message.type === 'snapshot') {
      this.options.operationState.replaceSnapshot(message.data);
      await this.options.onSnapshot?.(message.data);
      this.status.connection = 'connected';
      this.status.reconnectAttempt = 0;
      this.status.lastError = null;
      await this.options.systemStateRepository.saveStreamCursor({
        generation: message.data.generation,
        revision: message.data.revision,
        snapshotAt: new Date(message.data.observedAt),
      });
      return;
    }

    const result = this.options.operationState.applyEvent(message);
    if (result === 'applied') {
      await this.options.onEvent?.(message);
      await this.options.systemStateRepository.saveStreamCursor({
        generation: message.generation,
        revision: message.revision,
      });
    }
  }

  private scheduleReconnect(closeCode: number): void {
    const attempt = this.status.reconnectAttempt;
    const delay = calculateReconnectDelay(
      attempt,
      (this.options.random ?? Math.random)(),
      this.options.baseRetryMs,
      this.options.maxRetryMs,
      this.options.jitterMs,
    );
    this.status.connection = 'waiting_retry';
    this.status.reconnectAttempt += 1;
    this.options.logger.warn({ closeCode, delay, attempt: attempt + 1 }, 'WebSocket EcoRota desconectado; reconexão agendada.');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
