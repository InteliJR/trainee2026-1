/**
 * Testes da ligação entre as solicitações do morador e o estado em tempo real.
 */
import { describe, expect, it } from 'vitest';
import { createSnapshotFixture } from '../../../realtime/snapshotFixture';
import type { ResidentCollectionRequest } from '../types';
import { applyLiveToRequest, isTrackable, residentRequestKey, resolveResidentLive } from './residentLive';

// Cria a solicitação local do morador com a linha do tempo padrão da tela.
function createResidentRequest(overrides: Partial<ResidentCollectionRequest> = {}): ResidentCollectionRequest {
  return {
    id: 'uuid-local',
    externalReference: 'ref-s2',
    protocol: 'ECO-0001',
    materialId: 'plastico',
    materialName: 'Plásticos',
    pointName: 'Ponto Central',
    pointAddress: 'Rua A, 1',
    neighborhood: 'Centro',
    scheduledDate: '2026-09-27',
    shiftLabel: 'Tarde',
    shiftWindow: '13:00 - 17:00',
    status: 'pending',
    collectorName: null,
    collectorPhone: null,
    estimatedArrival: null,
    pointsPreview: 10,
    estimatedKg: null,
    timeline: [
      { status: 'pending', label: 'Recebida', occurredAt: '09:00', description: '' },
      { status: 'assigned', label: 'A caminho', occurredAt: null, description: '' },
      { status: 'in_service', label: 'No local', occurredAt: null, description: '' },
      { status: 'completed', label: 'Concluída', occurredAt: null, description: '' },
    ],
    ...overrides,
  };
}

describe('residentRequestKey', () => {
  it('prefere a referência externa e usa o ID quando ela não existe', () => {
    expect(residentRequestKey(createResidentRequest())).toBe('ref-s2');
    expect(residentRequestKey(createResidentRequest({ externalReference: undefined }))).toBe('uuid-local');
  });
});

describe('resolveResidentLive', () => {
  it('encontra a solicitação pela referência e resolve ponto e coletor', () => {
    const live = resolveResidentLive(createSnapshotFixture(), 'ref-s2');
    expect(live?.status).toBe('assigned');
    expect(live?.point?.name).toBe('Ponto Central');
    expect(live?.collector?.name).toBe('Coletor Ana');
  });

  it('devolve null sem snapshot ou quando a solicitação não está nele', () => {
    expect(resolveResidentLive(null, 'ref-s2')).toBeNull();
    expect(resolveResidentLive(createSnapshotFixture(), 'ref-inexistente')).toBeNull();
  });

  it('não inventa coletor para solicitação ainda pendente', () => {
    expect(resolveResidentLive(createSnapshotFixture(), 'ref-s1')?.collector).toBeNull();
  });
});

describe('isTrackable', () => {
  it('mostra o mapa só para atribuída ou em atendimento', () => {
    const snapshot = createSnapshotFixture();
    expect(isTrackable(resolveResidentLive(snapshot, 'ref-s2'))).toBe(true);
    expect(isTrackable(resolveResidentLive(snapshot, 'ref-s1'))).toBe(false);
    expect(isTrackable(resolveResidentLive(snapshot, 'ref-s3'))).toBe(false);
    expect(isTrackable(null)).toBe(false);
  });
});

describe('applyLiveToRequest', () => {
  it('aplica status e coletor ao vivo e registra o horário na linha do tempo', () => {
    const live = resolveResidentLive(createSnapshotFixture(), 'ref-s2');
    const result = applyLiveToRequest(createResidentRequest(), live);
    expect(result.status).toBe('assigned');
    expect(result.collectorName).toBe('Coletor Ana');
    expect(result.timeline[1].occurredAt).toMatch(/^\d{2}:\d{2}$/);
    // Não altera etapas que já tinham horário nem etapas futuras.
    expect(result.timeline[0].occurredAt).toBe('09:00');
    expect(result.timeline[2].occurredAt).toBeNull();
  });

  it('mantém a solicitação intacta sem dado ao vivo ou quando o morador já cancelou', () => {
    const request = createResidentRequest();
    expect(applyLiveToRequest(request, null)).toBe(request);
    const cancelled = createResidentRequest({ status: 'cancelled' });
    expect(applyLiveToRequest(cancelled, resolveResidentLive(createSnapshotFixture(), 'ref-s2'))).toBe(cancelled);
  });
});
