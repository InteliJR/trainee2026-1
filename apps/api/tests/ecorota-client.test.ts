import { describe, expect, it, vi } from 'vitest';
import { FakeEcoRotaClient } from '../src/integration/fake/fakeEcoRotaClient.js';
import { HttpEcoRotaClient } from '../src/integration/http/httpEcoRotaClient.js';

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
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(client.getSnapshot()).rejects.toMatchObject({ externalCode: 'INVALID_CONTRACT' });
  });
});

