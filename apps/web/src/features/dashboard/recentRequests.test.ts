/**
 * Testes da seleção de solicitações recentes do painel operacional.
 */
import { describe, expect, it } from 'vitest';
import { createRequest, createSnapshotFixture } from '../../realtime/snapshotFixture';
import { countByFilter, selectRecentRequests } from './recentRequests';

describe('selectRecentRequests', () => {
  it('devolve lista vazia antes do primeiro snapshot', () => {
    expect(selectRecentRequests(null)).toEqual([]);
  });

  it('ordena pela atualização mais recente e resolve nomes de ponto e coletor', () => {
    const rows = selectRecentRequests(createSnapshotFixture());
    expect(rows.map((row) => row.id)).toEqual(['s2', 's3', 's1']);
    expect(rows[0]).toMatchObject({ pointName: 'Ponto Central', collectorName: 'Coletor Ana' });
    expect(rows[1].pointName).toBe('Ponto Norte');
    expect(rows[2].collectorName).toBeNull();
  });

  it('aplica filtro e limite', () => {
    const snapshot = createSnapshotFixture();
    expect(selectRecentRequests(snapshot, { filter: 'ativas' }).map((row) => row.id)).toEqual(['s2', 's1']);
    expect(selectRecentRequests(snapshot, { filter: 'concluidas' }).map((row) => row.id)).toEqual(['s3']);
    expect(selectRecentRequests(snapshot, { filter: 'canceladas' })).toEqual([]);
    expect(selectRecentRequests(snapshot, { limit: 1 }).map((row) => row.id)).toEqual(['s2']);
  });

  it('usa os IDs quando ponto ou coletor ainda não estão no snapshot', () => {
    const snapshot = createSnapshotFixture([
      createRequest({ id: 's9', pointId: 'ponto-x', collectorId: 'coletor-x' }),
    ]);
    expect(selectRecentRequests(snapshot)[0]).toMatchObject({ pointName: 'ponto-x', collectorName: 'coletor-x' });
  });

  it('manda datas inválidas para o fim', () => {
    const snapshot = createSnapshotFixture([
      createRequest({ id: 'invalida', updatedAt: 'não é data' }),
      createRequest({ id: 'valida', updatedAt: '2026-09-27T10:00:00.000Z' }),
    ]);
    expect(selectRecentRequests(snapshot).map((row) => row.id)).toEqual(['valida', 'invalida']);
  });
});

describe('countByFilter', () => {
  it('conta cada solicitação no total e no seu grupo', () => {
    expect(countByFilter(createSnapshotFixture())).toEqual({ todas: 3, ativas: 2, concluidas: 1, canceladas: 0 });
    expect(countByFilter(null)).toEqual({ todas: 0, ativas: 0, concluidas: 0, canceladas: 0 });
  });
});
