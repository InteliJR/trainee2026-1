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

interface HttpEcoRotaClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

interface ExternalErrorBody {
  code?: string;
  message?: string;
}

function isEnvelope(value: unknown): value is EcoRotaEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return 'data' in candidate
    && Number.isInteger(candidate.revision)
    && Number.isInteger(candidate.generation)
    && typeof candidate.simulationTime === 'number'
    && typeof candidate.observedAt === 'string';
}

export class HttpEcoRotaClient implements EcoRotaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: HttpEcoRotaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  createRequest(input: CreateEcoRotaRequestInput): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.send('/v1/requests', { method: 'POST', body: JSON.stringify(input) });
  }

  cancelRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.send(`/v1/requests/${encodeURIComponent(requestId)}/cancel`, { method: 'POST' });
  }

  completeRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.send(`/v1/requests/${encodeURIComponent(requestId)}/complete`, { method: 'POST' });
  }

  getSnapshot(): Promise<EcoRotaEnvelope<EcoRotaSnapshot>> {
    return this.send('/v1/snapshot');
  }

  listPoints(): Promise<EcoRotaEnvelope<Point[]>> {
    return this.send('/v1/points');
  }

  listCollectors(): Promise<EcoRotaEnvelope<Collector[]>> {
    return this.send('/v1/collectors');
  }

  updateCollector(id: string, input: UpdateEcoRotaCollectorInput): Promise<EcoRotaEnvelope<Collector>> {
    return this.send(`/v1/collectors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  private async send<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

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
      if (!response.ok) {
        const external = body as ExternalErrorBody | null;
        throw new EcoRotaIntegrationError(
          external?.message ?? 'A EcoRota rejeitou a operação.',
          response.status,
          external?.code ?? null,
          response.status === 429 || response.status >= 500,
        );
      }

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

  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new EcoRotaIntegrationError('A EcoRota retornou uma resposta inválida.', response.status, 'INVALID_RESPONSE', true);
    }
  }
}
