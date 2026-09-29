/**
 * Testes da rota do coletor: link de navegação e destino montado a partir da API.
 */
import { describe, expect, it } from 'vitest';
import { fromDTO, type RequestDTO } from '../api/http';
import { directionsUrl, shouldSendPosition } from './route';

function dto(overrides: Partial<RequestDTO> = {}): RequestDTO {
  return {
    id: 'coleta-1',
    status: 'ATRIBUIDA',
    materiais: [{ tipo: 'PAPEL' }],
    dataDesejada: '2026-10-01T13:00:00.000Z',
    motivoCancelamento: null,
    concluidaEm: null,
    criadoEm: '2026-09-28T10:00:00.000Z',
    endereco: null,
    pontoColeta: { nome: 'INTELI', circuito: 1, coordenadas: { latitude: -23.5557, longitude: -46.7336 } },
    ...overrides,
  };
}

describe('directionsUrl', () => {
  it('monta o link do Google Maps com o destino em latitude,longitude', () => {
    const url = new URL(directionsUrl([-46.7336, -23.5557]));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('-23.5557,-46.7336');
    expect(url.searchParams.get('travelmode')).toBe('driving');
    expect(url.searchParams.has('origin')).toBe(false);
  });

  it('inclui a origem quando a posição do coletor é conhecida', () => {
    const url = new URL(directionsUrl([-46.7336, -23.5557], [-46.74, -23.56]));
    expect(url.searchParams.get('origin')).toBe('-23.56,-46.74');
  });
});

describe('destino da coleta', () => {
  it('usa o ponto de coleta, com coordenadas em [longitude, latitude]', () => {
    expect(fromDTO(dto()).destination).toEqual({ name: 'INTELI', coordinates: [-46.7336, -23.5557] });
  });

  it('usa o endereço do morador nas coletas antigas', () => {
    const task = fromDTO(dto({
      pontoColeta: null,
      endereco: { logradouro: 'Rua do MVP', numero: '10', bairro: 'Centro', cidade: 'São Paulo', latitude: -23.55, longitude: -46.63 },
    }));
    expect(task.destination).toEqual({ name: 'Rua do MVP, 10', coordinates: [-46.63, -23.55] });
  });

  it('fica sem destino quando a API não manda coordenadas', () => {
    expect(fromDTO(dto({ pontoColeta: { nome: 'INTELI', circuito: 1 } })).destination).toBeNull();
  });
});

describe('shouldSendPosition', () => {
  const origin: [number, number] = [-46.7336, -23.5557];

  it('envia a primeira posição', () => {
    expect(shouldSendPosition(null, origin, 1_000)).toBe(true);
  });

  it('espera 15 s parado, mas envia antes se o coletor andar 25 m', () => {
    const last = { coordinates: origin, at: 0 };
    expect(shouldSendPosition(last, origin, 10_000)).toBe(false);
    expect(shouldSendPosition(last, origin, 15_000)).toBe(true);
    // Cerca de 33 m ao norte.
    expect(shouldSendPosition(last, [-46.7336, -23.5554], 5_000)).toBe(true);
  });

  it('nunca envia duas vezes em menos de 3 s', () => {
    expect(shouldSendPosition({ coordinates: origin, at: 0 }, [-46.72, -23.55], 2_000)).toBe(false);
  });
});
