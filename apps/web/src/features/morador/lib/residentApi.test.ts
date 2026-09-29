/**
 * Testes das traduções entre a API em português e os tipos das telas do morador.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  addressToApi,
  createRequestInApi,
  desiredDateToIso,
  estimatedKg,
  fetchResidentRequests,
  fetchCollectionPoints,
  pointFromApi,
  requestFromApi,
  validateAddress,
  type AddressForm,
  type PointDTO,
  type RequestDTO,
} from './residentApi';

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

describe('pontos do operador', () => {
  it('lista pontos ativos e solicita no ponto escolhido sem enviar endereço', async () => {
    const calls: Array<{ path: string; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input);
      calls.push({ path, body: init?.body as string | undefined });
      const data = path.includes('/pontos-coleta-locais')
        ? { dados: [{ id: POINT.id, nome: 'Ecoponto Centro', tipo: 'HABITUAL', coordenadas: POINT.coordenadas, circuito: 2, descricao: 'Praça central' }] }
        : createRequestDto({ endereco: null, integracao: { pontoColetaExternoId: null, pontoColetaId: POINT.id },
          pontoColeta: { id: POINT.id, nome: 'Ecoponto Centro', circuito: 2, coordenadas: POINT.coordenadas } });
      return { ok: true, json: async () => data };
    }));
    try {
      const points = await fetchCollectionPoints();
      expect(points[0]).toMatchObject({ name: 'Ecoponto Centro', address: 'Praça central' });
      await createRequestInApi({ materialId: 'papel', pointId: POINT.id, desiredDate: '2026-12-01', shift: 'manha', notes: '' }, points[0]!);
      const body = JSON.parse(calls.find((call) => call.path.includes('/solicitacoes-coleta'))!.body!);
      expect(body).toMatchObject({ pontoColetaId: POINT.id, materiais: [{ tipo: 'PAPEL' }] });
      expect(body).not.toHaveProperty('enderecoId');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('fetchResidentRequests', () => {
  it('inclui todas as páginas para o resumo contar todas as coletas', async () => {
    const paths: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const path = String(input);
      paths.push(path);
      const data = path.includes('/pontos-coleta')
        ? { dados: [] }
        : path.includes('pagina=2')
          ? { dados: [createRequestDto({ id: 'segunda-coleta', status: 'CONCLUIDA' })] }
          : { dados: [createRequestDto({ id: 'primeira-coleta', status: 'CONCLUIDA' })], paginacao: { totalPaginas: 2 } };
      return { ok: true, json: async () => data };
    }));
    try {
      const requests = await fetchResidentRequests();
      expect(requests.map((request) => request.id)).toEqual(['primeira-coleta', 'segunda-coleta']);
      expect(paths.some((path) => path.includes('pagina=2&limite=100'))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
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
  it('usa o ponto do operador quando a coleta não tem endereço residencial', () => {
    const request = requestFromApi(createRequestDto({
      endereco: null,
      integracao: { pontoColetaExternoId: null, pontoColetaId: POINT.id },
      pontoColeta: { id: POINT.id, nome: 'Ecoponto Centro', circuito: 2, coordenadas: POINT.coordenadas },
    }), new Map());
    expect(request).toMatchObject({ pointName: 'Ecoponto Centro', pointAddress: 'Circuito 2' });
  });
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

// Formulário de endereço válido, que cada cenário altera.
function createAddressForm(overrides: Partial<AddressForm> = {}): AddressForm {
  return {
    rotulo: 'Casa',
    cep: '05508-010',
    logradouro: 'Av. Prof. Luciano Gualberto',
    numero: '380',
    complemento: '',
    bairro: 'Butantã',
    cidade: 'São Paulo',
    estado: 'sp',
    referencia: '',
    padrao: true,
    localizacao: [-46.7345, -23.5545],
    ...overrides,
  };
}

describe('validateAddress', () => {
  it('aceita um endereço completo, com CEP com ou sem hífen', () => {
    expect(validateAddress(createAddressForm())).toEqual({});
    expect(validateAddress(createAddressForm({ cep: '05508010' }))).toEqual({});
  });

  it('aponta cada campo inválido com a mesma regra da API', () => {
    const errors = validateAddress(createAddressForm({
      rotulo: ' ',
      cep: '0550-801',
      logradouro: 'A',
      numero: '',
      bairro: '',
      cidade: 'X',
      estado: 'São Paulo',
      localizacao: null,
    }));
    expect(Object.keys(errors).sort()).toEqual(
      ['bairro', 'cep', 'cidade', 'estado', 'localizacao', 'logradouro', 'numero', 'rotulo'].sort(),
    );
  });
});

describe('addressToApi', () => {
  it('separa latitude e longitude, põe a UF em maiúsculas e omite opcionais vazios', () => {
    const body = addressToApi(createAddressForm({ referencia: '  portão azul ' }));
    expect(body).toMatchObject({ latitude: -23.5545, longitude: -46.7345, estado: 'SP', referencia: 'portão azul', padrao: true });
    expect(body.complemento).toBeUndefined();
  });
});

describe('estimatedKg', () => {
  it('soma só as quantidades informadas em kg', () => {
    expect(estimatedKg([
      { tipo: 'PAPEL', quantidadeEstimada: 2, unidade: 'kg' },
      { tipo: 'VIDRO', quantidadeEstimada: 1.5, unidade: 'KG' },
      { tipo: 'METAL', quantidadeEstimada: 3, unidade: 'unidades' },
    ])).toBe(3.5);
  });

  it('devolve null quando nada foi informado em kg, sem inventar peso', () => {
    expect(estimatedKg([{ tipo: 'PAPEL' }])).toBeNull();
    expect(estimatedKg([{ tipo: 'PAPEL', quantidadeEstimada: null, unidade: 'kg' }])).toBeNull();
  });
});
