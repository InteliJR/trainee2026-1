/**
 * Adaptador HTTP real da EcoRota: envia Bearer token, aplica timeout, valida envelopes e normaliza erros externos.
 * A chave fica restrita ao backend e nunca aparece nas respostas ou no frontend.
 */
import {
  EcoRotaIntegrationError,
  type CreateEcoRotaRequestInput,
  type EcoRotaClient,
  type EcoRotaEnvelope,
  type EcoRotaRequest,
  type EcoRotaSnapshot,
  type UpdateEcoRotaCollectorInput,
} from '../ecorotaClient.js';
import type { Collector, Point } from '@ecorota/shared';

// Reúne URL, chave, timeout e implementação fetch injetável do adaptador.
export interface HttpEcoRotaClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxAttempts?: number;
  baseRetryDelayMs?: number;
  fetchImplementation?: typeof fetch;
  sleepImplementation?: (delayMs: number) => Promise<void>;
  randomImplementation?: () => number;
  onRetry?: (context: { path: string; attempt: number; delayMs: number; error: EcoRotaIntegrationError }) => void;
}

// Descreve o corpo parcial que pode acompanhar uma resposta de erro externa.
interface ExternalErrorBody {
  code?: string;
  message?: string;
}

// Verifica em runtime se a resposta contém dados e metadados mínimos do envelope.
function isEnvelope(value: unknown): value is EcoRotaEnvelope<unknown> {
  // Elimina null e valores primitivos antes de ler propriedades do envelope.
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return 'data' in candidate
    && Number.isInteger(candidate.revision)
    && Number.isInteger(candidate.generation)
    && typeof candidate.simulationTime === 'number'
    && typeof candidate.observedAt === 'string';
}

// Implementa cada operação do contrato reutilizando uma única rotina de request segura.
export class HttpEcoRotaClient implements EcoRotaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly fetchImplementation: typeof fetch;
  private readonly sleepImplementation: (delayMs: number) => Promise<void>;
  private readonly randomImplementation: () => number;

  // Normaliza URL, timeout e fetch uma única vez para todas as operações seguintes.
  constructor(private readonly options: HttpEcoRotaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 250;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sleepImplementation = options.sleepImplementation ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.randomImplementation = options.randomImplementation ?? Math.random;
    // Impede configurações que eliminariam todas as tentativas ou criariam atrasos negativos.
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) throw new Error('maxAttempts deve ser inteiro e positivo.');
    // Rejeita base inválida antes que uma falha externa tente calcular o backoff.
    if (!Number.isFinite(this.baseRetryDelayMs) || this.baseRetryDelayMs < 0) throw new Error('baseRetryDelayMs deve ser não negativo.');
  }

  // Envia criação idempotente usando a referência externa produzida pelo domínio local.
  createRequest(input: CreateEcoRotaRequestInput): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.send('/v1/requests', { method: 'POST', body: JSON.stringify(input) });
  }

  // Solicita a transição externa para cancelada.
  cancelRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.send(`/v1/requests/${encodeURIComponent(requestId)}/cancel`, { method: 'POST' });
  }

  // Solicita a transição externa para concluída.
  completeRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.send(`/v1/requests/${encodeURIComponent(requestId)}/complete`, { method: 'POST' });
  }

  // Busca o estado integral usado como fallback ou inicialização.
  getSnapshot(): Promise<EcoRotaEnvelope<EcoRotaSnapshot>> {
    return this.send('/v1/snapshot');
  }

  // Consulta todos os pontos conhecidos pela EcoRota.
  listPoints(): Promise<EcoRotaEnvelope<Point[]>> {
    return this.send('/v1/points');
  }

  // Consulta todos os coletores e sua telemetria atual.
  listCollectors(): Promise<EcoRotaEnvelope<Collector[]>> {
    return this.send('/v1/collectors');
  }

  // Atualiza nome ou disponibilidade do coletor externo indicado.
  updateCollector(id: string, input: UpdateEcoRotaCollectorInput): Promise<EcoRotaEnvelope<Collector>> {
    return this.send(`/v1/collectors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // Executa a chamada comum e repete somente falhas explicitamente marcadas como recuperáveis.
  private async send<T>(path: string, init: RequestInit = {}): Promise<T> {
    // Numera tentativas a partir de um para produzir logs e métricas legíveis.
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      // Preserva a última falha quando o limite de tentativas for atingido.
      try {
        // Cada tentativa cria seu próprio AbortController e temporizador.
        return await this.sendOnce<T>(path, init);
      } catch (error) {
        // Erros internos inesperados não devem entrar em repetição silenciosa.
        if (!(error instanceof EcoRotaIntegrationError)) throw error;
        // Status 4xx definitivos e a última tentativa são devolvidos imediatamente ao serviço.
        if (!error.retryable || attempt >= this.maxAttempts) throw error;
        // Aplica backoff exponencial com jitter entre 50% e 150%, limitado a cinco segundos.
        const exponentialDelay = this.baseRetryDelayMs * 2 ** (attempt - 1);
        // Usa random injetável para manter testes determinísticos.
        const jitterMultiplier = 0.5 + this.randomImplementation();
        // Arredonda o valor final e impede espera excessiva no caminho HTTP síncrono.
        const delayMs = Math.min(5_000, Math.round(exponentialDelay * jitterMultiplier));
        // Entrega contexto ao logger/telemetria sem incluir Bearer token ou corpo sensível.
        this.options.onRetry?.({ path, attempt, delayMs, error });
        // Aguarda de forma injetável antes de abrir a próxima tentativa.
        await this.sleepImplementation(delayMs);
      }
    }
    // O laço sempre retorna ou lança; esta guarda protege alterações futuras na configuração.
    throw new EcoRotaIntegrationError('A EcoRota não respondeu após as tentativas configuradas.', null, 'RETRY_EXHAUSTED', false);
  }

  // Executa uma única tentativa com Bearer, timeout, parse, validação e tradução de falhas.
  private async sendOnce<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    // Garante cancelamento do temporizador tanto em sucesso quanto em qualquer falha.
    try {
      const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...init.headers,
        },
      });

      const body = await this.readBody(response);
      // Converte status não 2xx em erro de integração com código e indicação de retry.
      if (!response.ok) {
        const external = body as ExternalErrorBody | null;
        throw new EcoRotaIntegrationError(
          external?.message ?? 'A EcoRota rejeitou a operação.',
          response.status,
          external?.code ?? null,
          response.status === 429 || response.status >= 500,
        );
      }

      // Rejeita sucesso HTTP que não respeita o contrato esperado da EcoRota.
      if (!isEnvelope(body)) {
        throw new EcoRotaIntegrationError(
          'A EcoRota retornou dados fora do contrato esperado.',
          response.status,
          'INVALID_CONTRACT',
          true,
        );
      }

      return body as T;
    } catch (error) {
      // Preserva erros já normalizados e trata abaixo apenas falhas de transporte/timeout.
      if (error instanceof EcoRotaIntegrationError) throw error;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new EcoRotaIntegrationError(
        timedOut ? 'A EcoRota excedeu o tempo limite de resposta.' : 'Não foi possível comunicar com a EcoRota.',
        null,
        timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // Lê texto primeiro para tolerar respostas vazias e detectar JSON inválido explicitamente.
  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    // Resposta sem conteúdo é representada como null em vez de provocar JSON.parse.
    if (!text) return null;
    // Faz parse isolado para produzir erro específico quando o corpo não é JSON.
    try {
      return JSON.parse(text);
    } catch {
      throw new EcoRotaIntegrationError('A EcoRota retornou uma resposta inválida.', response.status, 'INVALID_RESPONSE', true);
    }
  }
}
