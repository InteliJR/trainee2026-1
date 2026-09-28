/**
 * Testes unitários das funções puras do mapa operacional.
 * Cobrem telemetria, animação e conversão de rotas sem instanciar MapLibre.
 */
import { describe, expect, it } from 'vitest';
import type { RealtimeRoute } from '../realtime/socketClient';
import {
  ROUTE_COLORS,
  formatTelemetryAge,
  interpolateLngLat,
  isTelemetryStale,
  routeColorFor,
  routesToFeatureCollection,
} from './mapUtils';

// Fixa um instante de referência para que as idades calculadas sejam determinísticas.
const NOW = Date.parse('2026-09-27T12:00:00.000Z');

// Cria uma rota mínima que cada cenário pode ajustar.
function createRoute(overrides: Partial<RealtimeRoute> = {}): RealtimeRoute {
  return {
    collectorId: 'coletor-1',
    revision: 1,
    reason: 'assignment',
    destinationId: null,
    habitualPointIds: [],
    nextHabitualPointId: 'ponto-1',
    geometry: { type: 'LineString', coordinates: [[-46.66, -23.57], [-46.65, -23.56]] },
    distanceMeters: 1_000,
    durationMs: 60_000,
    remainingMs: 30_000,
    stops: [],
    ...overrides,
  };
}

describe('isTelemetryStale', () => {
  it('considera recente uma posição dentro do limite', () => {
    expect(isTelemetryStale('2026-09-27T11:59:50.000Z', NOW, 15_000)).toBe(false);
  });

  it('considera desatualizada uma posição além do limite ou com data inválida', () => {
    expect(isTelemetryStale('2026-09-27T11:59:40.000Z', NOW, 15_000)).toBe(true);
    expect(isTelemetryStale('não é data', NOW, 15_000)).toBe(true);
  });
});

describe('formatTelemetryAge', () => {
  it('usa segundos, minutos e horas conforme a idade', () => {
    expect(formatTelemetryAge('2026-09-27T11:59:18.000Z', NOW)).toBe('há 42 s');
    expect(formatTelemetryAge('2026-09-27T11:55:00.000Z', NOW)).toBe('há 5 min');
    expect(formatTelemetryAge('2026-09-27T09:00:00.000Z', NOW)).toBe('há 3 h');
  });

  it('não mostra idade negativa quando o relógio do servidor está adiantado', () => {
    expect(formatTelemetryAge('2026-09-27T12:00:05.000Z', NOW)).toBe('há 0 s');
  });

  it('avisa quando não há data válida', () => {
    expect(formatTelemetryAge('', NOW)).toBe('sem registro');
  });
});

describe('interpolateLngLat', () => {
  it('começa na origem, termina no destino e não ultrapassa os extremos', () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [10, -10];
    expect(interpolateLngLat(from, to, 0)).toEqual([0, 0]);
    expect(interpolateLngLat(from, to, 1)).toEqual([10, -10]);
    expect(interpolateLngLat(from, to, 2)).toEqual([10, -10]);
    expect(interpolateLngLat(from, to, -1)).toEqual([0, 0]);
  });

  it('avança mais da metade do caminho na metade do tempo por causa do easing de saída', () => {
    const [lng] = interpolateLngLat([0, 0], [10, 0], 0.5);
    expect(lng).toBeGreaterThan(5);
    expect(lng).toBeLessThan(10);
  });
});

describe('routesToFeatureCollection', () => {
  it('converte cada rota em uma linha colorida pelo coletor', () => {
    const collection = routesToFeatureCollection([createRoute()]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].geometry.coordinates).toEqual([[-46.66, -23.57], [-46.65, -23.56]]);
    expect(collection.features[0].properties).toEqual({ collectorId: 'coletor-1', color: routeColorFor('coletor-1') });
  });

  it('descarta rotas com menos de dois vértices', () => {
    const route = createRoute({ geometry: { type: 'LineString', coordinates: [[-46.66, -23.57]] } });
    expect(routesToFeatureCollection([route]).features).toHaveLength(0);
  });
});

describe('routeColorFor', () => {
  it('é estável para o mesmo coletor e sempre vem da paleta', () => {
    expect(routeColorFor('coletor-7')).toBe(routeColorFor('coletor-7'));
    expect(ROUTE_COLORS).toContain(routeColorFor('qualquer-id'));
  });
});
