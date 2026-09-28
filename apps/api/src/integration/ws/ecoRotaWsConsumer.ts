/**
 * Mantém a única conexão WebSocket do backend com a EcoRota.
 * Autentica, serializa processamento, atualiza o cache, persiste cursor e reconecta com backoff e jitter.
 */
import WebSocket, { type ClientOptions, type RawData } from 'ws';
import type { OperationStateStore } from '../operation-state/operationState.js';
import type { EcoRotaEventMessage, EcoRotaSnapshot } from '../ecorotaClient.js';
import { parseEcoRotaStreamMessage } from './streamMessage.js';
import type { SystemStateRepository } from './systemState.repository.js';

// Enumera as fases públicas usadas pelo endpoint de observabilidade da integração.
export type StreamConnectionStatus = 'stopped' | 'connecting' | 'connected' | 'waiting_retry' | 'authentication_error';

// Expõe conexão, tentativas e últimos sinais sem revelar a credencial.
export interface StreamStatus {
  connection: StreamConnectionStatus;
  reconnectAttempt: number;
  lastMessageAt: string | null;
  lastError: string | null;
}

// Define somente os métodos de log necessários, permitindo injetar Fastify ou fake.
interface StreamLogger {
  info(data: object, message: string): void;
  warn(data: object, message: string): void;
  error(data: object, message: string): void;
}

// Agrupa configuração, dependências, callbacks e pontos de substituição para testes.
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

// Converte http(s) em ws(s), normaliza a barra e fixa o endpoint /v1/stream.
export function toWebSocketUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/stream`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

// Calcula backoff exponencial limitado e adiciona jitter para evitar reconexões simultâneas.
export function calculateReconnectDelay(
  attempt: number,
  randomValue: number,
  baseRetryMs = 1_000,
  maxRetryMs = 30_000,
  jitterMs = 500,
): number {
  return Math.min(maxRetryMs, baseRetryMs * 2 ** attempt) + Math.floor(randomValue * jitterMs);
}

// Gerencia socket, fila serial de mensagens, estado observável e temporizador de reconexão.
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

  // Guarda todas as dependências sem abrir conexão durante a construção do objeto.
  constructor(private readonly options: EcoRotaWsConsumerOptions) {}

  // Marca o consumidor como ativo e inicia somente uma tentativa de conexão.
  start(): void {
    // Evita abrir uma segunda conexão quando start é chamado novamente.
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  // Cancela retry, fecha o socket e aguarda a fila de mensagens já recebidas.
  async stop(): Promise<void> {
    this.stopped = true;
    // Cancela tentativa futura para garantir que stop seja definitivo.
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.status.connection = 'stopped';
    this.socket?.close(1000, 'Encerramento da API');
    this.socket = null;
    await this.processing;
  }

  // Retorna uma cópia para impedir mutação externa do estado de conexão.
  getStatus(): StreamStatus {
    return { ...this.status };
  }

  // Cria o socket autenticado e registra handlers de abertura, mensagem, erro e fechamento.
  private connect(): void {
    // Não conecta quando um shutdown ocorreu entre o agendamento e a execução.
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
      // Fechamento provocado por stop não deve agendar reconexão.
      if (this.stopped) return;
      // Falhas de política/autenticação exigem corrigir credencial e não devem entrar em loop.
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

  // Valida a mensagem, atualiza cache/domínio/cursor e só então confirma o processamento.
  private async processMessage(raw: string): Promise<void> {
    const message = parseEcoRotaStreamMessage(raw);
    this.status.lastMessageAt = new Date().toISOString();

    // Snapshot inicializa integralmente cache/domínio antes de marcar a conexão como saudável.
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
    // Só sincroniza/persiste cursor quando o cache aceitou efetivamente o evento.
    if (result === 'applied') {
      await this.options.onEvent?.(message);
      await this.options.systemStateRepository.saveStreamCursor({
        generation: message.generation,
        revision: message.revision,
      });
    }
  }

  // Calcula o próximo atraso, atualiza telemetria e agenda uma única reconexão.
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
