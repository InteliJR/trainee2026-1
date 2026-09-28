/**
 * Testes das traduções entre a API em português e os tipos das telas do morador.
 */
import { describe, expect, it } from 'vitest';
import { desiredDateToIso, pointFromApi, requestFromApi, type PointDTO, type RequestDTO } from './residentApi';

const POINT: PointDTO = {
  id: '85fc99ba-e984-46c3-94d9-e8f72fb13ac8',
  nome: 'Ponto 01',
  tipo: 'HABITUAL',
  coordenadas: { latitude: -23.5545, longitude: -46.7345 },
  circuito: 1,
  demanda: { pendentes: 1, atribuidas: 0, emAtendimento: 0, concluidas: 3, canceladas: 0 },
  distanciaKm: 1.234,
};

function createRequestDto(overrides: Partial<RequestDTO> = {}): RequestDTO {
  return {
    id: '31480ddc-0e45-4209-814e-951a24747c8c',
    referenciaExterna: 'pedido-97118aa3',
    status: 'ATRIBUIDA',
    integracao: { pontoColetaExternoId: POINT.id },
    dataDesejada: new Date(2026, 8, 30, 13, 0).toISOString(),
    criadoEm: new Date(2026, 8, 28, 9, 5).toISOString(),
    concluidaEm: null,
    endereco: { logradouro: 'Rua do MVP', numero: '10', bairro: 'Vila Teste' },
    materiais: [{ tipo: 'PLASTICO' }],
    coletor: { nome: 'Coletor base 1' },
    pontosConcedidos: [],
    ...overrides,
  };
}

describe('pointFromApi', () => {
  it('converte coordenadas para [longitude, latitude] e usa o circuito como região', () => {
    const point = pointFromApi(POINT);
    expect(point.coordinates).toEqual([-46.7345, -23.5545]);
    expect(point.kind).toBe('habitual');
    expect(point.neighborhood).toBe('Circuito 1');
    expect(point.distanceKm).toBe(1.2);
    expect(point.demand.completed).toBe(3);
    expect(point.accepts).toContain('plastico');
  });

  it('marca pontos adicionais e distância ausente como zero', () => {
    const point = pointFromApi({ ...POINT, tipo: 'ADICIONAL', distanciaKm: null });
    expect(point.kind).toBe('additional');
    expect(point.distanceKm).toBe(0);
  });
});

describe('desiredDateToIso', () => {
  it('combina o dia escolhido com o início do turno no fuso local', () => {
    expect(new Date(desiredDateToIso('2026-09-30', 'manha')).getHours()).toBe(8);
    expect(new Date(desiredDateToIso('2026-09-30', 'tarde')).getHours()).toBe(13);
    const night = new Date(desiredDateToIso('2026-09-30', 'noite'));
    expect([night.getFullYear(), night.getMonth(), night.getDate(), night.getHours()]).toEqual([2026, 8, 30, 18]);
  });
});

describe('requestFromApi', () => {
  it('traduz status, material, turno, ponto e coletor', () => {
    const request = requestFromApi(createRequestDto(), new Map([[POINT.id, 'Ponto 01']]));
    expect(request).toMatchObject({
      id: '31480ddc-0e45-4209-814e-951a24747c8c',
      externalReference: 'pedido-97118aa3',
      protocol: 'ECO-747C8C',
      status: 'assigned',
      materialId: 'plastico',
      pointName: 'Ponto 01',
      pointAddress: 'Rua do MVP, 10',
      scheduledDate: '2026-09-30',
      shiftLabel: 'Tarde',
      collectorName: 'Coletor base 1',
    });
    expect(request.timeline[0].occurredAt).toMatch(/^\d{2}:\d{2}$/);
    expect(request.timeline[1].occurredAt).toBeNull();
  });

  it('trata AGENDADA como pendente, OUTRO como óleo e ponto desconhecido com nome genérico', () => {
    const request = requestFromApi(
      createRequestDto({ status: 'AGENDADA', materiais: [{ tipo: 'OUTRO' }], coletor: null }),
      new Map(),
    );
    expect(request.status).toBe('pending');
    expect(request.materialId).toBe('oleo');
    expect(request.pointName).toBe('Ponto de coleta');
    expect(request.collectorName).toBeNull();
  });

  it('usa os pontos concedidos quando existem e registra o horário da conclusão', () => {
    const request = requestFromApi(
      createRequestDto({
        status: 'CONCLUIDA',
        concluidaEm: new Date(2026, 8, 30, 14, 10).toISOString(),
        pontosConcedidos: [{ pontos: 10 }, { pontos: 5 }],
      }),
      new Map(),
    );
    expect(request.status).toBe('completed');
    expect(request.pointsPreview).toBe(15);
    expect(request.timeline[3].occurredAt).toMatch(/^\d{2}:\d{2}$/);
  });
});
