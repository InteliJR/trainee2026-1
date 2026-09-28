/**
 * Testes unitários do estado em tempo real do frontend.
 * Eles exercitam o reducer diretamente para validar dados sem abrir WebSocket nem montar componentes React.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_REALTIME_STATE, realtimeReducer } from './useTempoReal';
import type { RealtimeSnapshot } from './socketClient';

// Cria um snapshot pequeno e completo que pode ser alterado por cada cenário.
function createSnapshot(): RealtimeSnapshot {
  // Mantém IDs e datas determinísticos para tornar falhas fáceis de interpretar.
  return {
    generation: 2,
    revision: 10,
    simulationTime: 1_000,
    pollIntervalMs: 5_000,
    paused: false,
    observedAt: '2026-09-27T12:00:00.000Z',
    points: [{
      id: 'ponto-1',
      name: 'Ponto central',
      kind: 'habitual',
      coordinates: [-46.66, -23.57],
      circuit: 1,
      demand: { pending: 1, assigned: 0, in_service: 0, completed: 0, cancelled: 0 },
    }],
    collectors: [{
      id: 'coletor-1',
      name: 'Coletor 1',
      origin: 'system',
      available: true,
      status: 'available',
      circuit: 1,
      position: { type: 'Point', coordinates: [-46.65, -23.56] },
      observedAt: '2026-09-27T12:00:00.000Z',
    }],
    routes: [],
    requests: [{
      id: 'solicitacao-1',
      pointId: 'ponto-1',
      externalReference: 'referencia-1',
      status: 'pending',
      collectorId: null,
      createdAt: '2026-09-27T11:50:00.000Z',
      createdSimulationTime: 500,
      updatedAt: '2026-09-27T11:50:00.000Z',
    }],
    eventCursor: 'cursor-10',
    updatedAt: '2026-09-27T12:00:00.000Z',
  };
}

// Agrupa cenários relacionados à ordenação e aplicação dos eventos Socket.IO.
describe('realtimeReducer', () => {
  // Garante que uma reconexão atrasada não substitua o mapa por um estado antigo.
  it('ignora snapshots com revisão menor na mesma geração', () => {
    // Preenche o reducer com o snapshot atual.
    const current = realtimeReducer(INITIAL_REALTIME_STATE, { type: 'snapshot', snapshot: createSnapshot() });
    // Cria uma cópia mais antiga que simula uma resposta atrasada.
    const oldSnapshot = { ...createSnapshot(), revision: 9 };
    // Tenta aplicar o estado atrasado.
    const result = realtimeReducer(current, { type: 'snapshot', snapshot: oldSnapshot });
    // Confirma que a mesma referência foi preservada porque nenhuma alteração ocorreu.
    expect(result).toBe(current);
  });

  // Garante que o evento de posição atualiza somente o coletor correspondente.
  it('move o coletor quando recebe uma posição da mesma geração', () => {
    // Preenche o reducer com a base exigida pelos eventos incrementais.
    const current = realtimeReducer(INITIAL_REALTIME_STATE, { type: 'snapshot', snapshot: createSnapshot() });
    // Aplica uma coordenada mais recente recebida do backend.
    const result = realtimeReducer(current, {
      type: 'posicao-coletor',
      event: {
        coletorExternoId: 'coletor-1',
        posicao: { type: 'Point', coordinates: [-46.64, -23.55] },
        observadoEm: '2026-09-27T12:00:05.000Z',
        revisao: 11,
        geracao: 2,
      },
    });
    // Confirma a nova posição e o avanço da revisão global exibida.
    expect(result.snapshot?.collectors[0]?.position?.coordinates).toEqual([-46.64, -23.55]);
    expect(result.snapshot?.revision).toBe(11);
  });

  // Garante a tradução do evento público em português para o status técnico do snapshot.
  it('atualiza status e coletor de uma solicitação atribuída', () => {
    // Preenche o reducer com uma solicitação pendente.
    const current = realtimeReducer(INITIAL_REALTIME_STATE, { type: 'snapshot', snapshot: createSnapshot() });
    // Aplica o contrato traduzido enviado pela API.
    const result = realtimeReducer(current, {
      type: 'solicitacao',
      event: {
        idExterno: 'solicitacao-1',
        referenciaExterna: 'referencia-1',
        pontoColetaExternoId: 'ponto-1',
        coletorExternoId: 'coletor-1',
        status: 'ATRIBUIDA',
        ocorridoEm: '2026-09-27T12:01:00.000Z',
        revisao: 11,
        geracao: 2,
      },
    });
    // Confirma que o estado interno e o vínculo do coletor foram atualizados juntos.
    expect(result.snapshot?.requests[0]?.status).toBe('assigned');
    expect(result.snapshot?.requests[0]?.collectorId).toBe('coletor-1');
  });

  // Garante que dados incrementais de outra execução não contaminem o mapa atual.
  it('ignora eventos incrementais de outra geração', () => {
    // Preenche o reducer com a geração dois.
    const current = realtimeReducer(INITIAL_REALTIME_STATE, { type: 'snapshot', snapshot: createSnapshot() });
    // Tenta aplicar uma posição pertencente à geração anterior.
    const result = realtimeReducer(current, {
      type: 'posicao-coletor',
      event: {
        coletorExternoId: 'coletor-1',
        posicao: { type: 'Point', coordinates: [0, 0] },
        observadoEm: '2026-09-27T12:00:05.000Z',
        revisao: 99,
        geracao: 1,
      },
    });
    // Confirma que o estado não foi recriado nem alterado.
    expect(result).toBe(current);
  });
});
