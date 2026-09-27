/** Testa os adaptadores fake e HTTP, incluindo headers, envelopes, timeout e normalização de erros EcoRota. */
import { describe, expect, it, vi } from 'vitest';
import { FakeEcoRotaClient } from '../src/integration/fake/fakeEcoRotaClient.js';
import { HttpEcoRotaClient } from '../src/integration/http/httpEcoRotaClient.js';

// Identifica o ponto enviado nas criações externas simuladas.
const POINT_ID = '44444444-4444-4444-8444-444444444444';

describe('FakeEcoRotaClient', () => {
  it('reutiliza a solicitação quando ponto e referência são reenviados', async () => {
    const client = new FakeEcoRotaClient();
    const input = { pointId: POINT_ID, externalReference: 'pedido-idempotente' };

    const first = await client.createRequest(input);
    const repeated = await client.createRequest(input);

    expect(repeated.data.id).toBe(first.data.id);
    expect((await client.getSnapshot()).data.requests).toHaveLength(1);
  });
});

describe('HttpEcoRotaClient', () => {
  it('envia Bearer token e o contrato oficial de criação', async () => {
    const envelope = {
      data: {
        id: 'external-request',
        pointId: POINT_ID,
        externalReference: 'pedido-1',
        status: 'pending',
        collectorId: null,
        createdAt: new Date().toISOString(),
        createdSimulationTime: 1,
        updatedAt: new Date().toISOString(),
      },
      revision: 1,
      generation: 1,
      simulationTime: 1,
      observedAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status: 200 }));
    const client = new HttpEcoRotaClient({
      baseUrl: 'https://ecorota.example/',
      apiKey: 'segredo',
      fetchImplementation: fetchMock as typeof fetch,
    });

    const result = await client.createRequest({ pointId: POINT_ID, externalReference: 'pedido-1' });

    expect(result.data.id).toBe('external-request');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ecorota.example/v1/requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pointId: POINT_ID, externalReference: 'pedido-1' }),
        headers: expect.objectContaining({ authorization: 'Bearer segredo' }),
      }),
    );
  });

  it('marca limite 429 como erro que pode ser tentado novamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 'RATE_LIMIT', message: 'Limite atingido' }),
      { status: 429 },
    ));
    const client = new HttpEcoRotaClient({
      baseUrl: 'https://ecorota.example',
      apiKey: 'segredo',
      // Mantém este caso focado na classificação do erro, sem esperar retries.
      maxAttempts: 1,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(client.getSnapshot()).rejects.toMatchObject({
      statusCode: 429,
      externalCode: 'RATE_LIMIT',
      retryable: true,
    });
  });

  it('rejeita resposta de sucesso fora do envelope oficial', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const client = new HttpEcoRotaClient({
      baseUrl: 'https://ecorota.example',
      apiKey: 'segredo',
      // Contrato inválido é retryable; uma tentativa basta para este cenário específico.
      maxAttempts: 1,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(client.getSnapshot()).rejects.toMatchObject({ externalCode: 'INVALID_CONTRACT' });
  });

  // Confirma que indisponibilidade temporária não obriga o serviço de negócio a repetir manualmente.
  it('repete falha recuperável com backoff e retorna o primeiro sucesso', async () => {
    // Monta um envelope mínimo válido devolvido depois da falha inicial.
    const envelope = {
      data: [],
      revision: 2,
      generation: 1,
      simulationTime: 2,
      observedAt: '2026-09-27T12:00:00.000Z',
    };
    // Simula 503 na primeira chamada e sucesso na segunda.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'TEMPORARY', message: 'Indisponível' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope), { status: 200 }));
    // Substitui a espera real por uma função observável e instantânea.
    const sleep = vi.fn().mockResolvedValue(undefined);
    // Observa o contexto seguro entregue para logs de retry.
    const onRetry = vi.fn();
    const client = new HttpEcoRotaClient({
      baseUrl: 'https://ecorota.example',
      apiKey: 'segredo',
      fetchImplementation: fetchMock as typeof fetch,
      sleepImplementation: sleep,
      randomImplementation: () => 0.5,
      onRetry,
    });

    // Consulta pontos para exercitar a rotina comum de retry.
    const result = await client.listPoints();

    // Confirma recuperação, número de chamadas e backoff base de 250 ms sem jitter adicional.
    expect(result.revision).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ path: '/v1/points', attempt: 1, delayMs: 250 }));
  });

  // Evita repetir erros definitivos que só consumiriam cota externa.
  it('não repete erro 400 não recuperável', async () => {
    // Simula uma rejeição definitiva do contrato enviado.
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 'INVALID_INPUT', message: 'Entrada inválida' }),
      { status: 400 },
    ));
    const client = new HttpEcoRotaClient({
      baseUrl: 'https://ecorota.example',
      apiKey: 'segredo',
      fetchImplementation: fetchMock as typeof fetch,
      sleepImplementation: vi.fn(),
    });

    // Confirma a falha pública e a ausência de uma segunda requisição.
    await expect(client.getSnapshot()).rejects.toMatchObject({ statusCode: 400, retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
