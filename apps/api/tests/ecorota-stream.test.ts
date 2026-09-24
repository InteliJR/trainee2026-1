import { describe, expect, it } from 'vitest';
import { calculateReconnectDelay, toWebSocketUrl } from '../src/integration/ws/ecoRotaWsConsumer.js';
import { parseEcoRotaStreamMessage } from '../src/integration/ws/streamMessage.js';

describe('protocolo WebSocket EcoRota', () => {
  it('converte URL HTTPS para o endpoint WSS oficial', () => {
    expect(toWebSocketUrl('https://ecorota.example/')).toBe('wss://ecorota.example/v1/stream');
  });

  it('calcula backoff exponencial com jitter e teto', () => {
    expect(calculateReconnectDelay(0, 0.5)).toBe(1_250);
    expect(calculateReconnectDelay(10, 1)).toBe(30_500);
  });

  it('rejeita mensagens fora do contrato', () => {
    expect(() => parseEcoRotaStreamMessage('{invalido')).toThrow(/não é JSON/);
    expect(() => parseEcoRotaStreamMessage(JSON.stringify({ type: 'snapshot', data: {} }))).toThrow(/fora do contrato/);
  });

  it('aceita eventos oficiais', () => {
    const parsed = parseEcoRotaStreamMessage(JSON.stringify({
      id: '42',
      revision: 5,
      generation: 1,
      simulationTime: 100,
      occurredAt: '2026-09-24T10:00:00.000Z',
      type: 'simulation.updated',
      data: { paused: true },
    }));

    expect(parsed.type).toBe('simulation.updated');
  });
});

