/**
 * Tabela das solicitações mais recentes do painel operacional.
 * Lê o snapshot em tempo real, destaca por um instante a linha que acabou de mudar
 * e avisa o painel quando o operador escolhe uma linha, para o mapa centralizar no ponto.
 */
import { translateStatus } from '@ecorota/shared';
import { useEffect, useMemo, useState } from 'react';
import { formatAge } from '../../map/mapUtils';
import type { RealtimeRequestEvent, RealtimeRequestStatus, RealtimeSnapshot } from '../../realtime/socketClient';
import { colors } from '../../styles/design-tokens';
import { countByFilter, selectRecentRequests, type RecentRequestRow, type RequestFilter } from './recentRequests';

// Rótulos dos filtros rápidos na ordem em que aparecem.
const FILTERS: Array<[RequestFilter, string]> = [
  ['todas', 'Todas'],
  ['ativas', 'Ativas'],
  ['concluidas', 'Concluídas'],
  ['canceladas', 'Canceladas'],
];

// Reaproveita as cores de status do guia de estilos (texto e fundo suave).
const STATUS_COLORS: Record<RealtimeRequestStatus, { text: string; background: string }> = {
  pending: { text: colors.status.pending, background: colors.status['pending-bg'] },
  assigned: { text: colors.status.assigned, background: colors.status['assigned-bg'] },
  in_service: { text: colors.status['in-service'], background: colors.status['in-service-bg'] },
  completed: { text: colors.status.completed, background: colors.status['completed-bg'] },
  cancelled: { text: colors.status.cancelled, background: colors.status['cancelled-bg'] },
};

// Tempo em que a linha alterada fica destacada depois de um evento.
const HIGHLIGHT_MS = 2_500;

interface RecentRequestsTableProps {
  snapshot: RealtimeSnapshot | null;
  // Último evento de solicitação recebido; muda de referência a cada evento.
  lastRequestEvent: RealtimeRequestEvent | null;
  // Chamado quando o operador escolhe uma linha.
  onSelectPoint?: (pointId: string) => void;
}

// Renderiza filtros, contagens e a lista de solicitações recentes.
export function RecentRequestsTable({ snapshot, lastRequestEvent, onSelectPoint }: RecentRequestsTableProps) {
  const [filter, setFilter] = useState<RequestFilter>('todas');
  // Guarda a referência externa da linha destacada no momento.
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // Atualiza os textos "há X" sem depender de novos eventos.
  const [now, setNow] = useState(() => Date.now());

  const rows = useMemo(() => selectRecentRequests(snapshot, { filter }), [snapshot, filter]);
  const counts = useMemo(() => countByFilter(snapshot), [snapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  // Destaca a linha citada pelo evento mais recente e remove o destaque depois de alguns segundos.
  useEffect(() => {
    if (!lastRequestEvent) return undefined;
    setHighlighted(lastRequestEvent.referenciaExterna);
    setNow(Date.now());
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [lastRequestEvent]);

  return (
    <section
      aria-labelledby="recent-requests-title"
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: '#FFFFFF', fontFamily: 'sans-serif' }}
    >
      <header style={{ padding: '12px 14px 8px', borderBottom: '1px solid #E5E7EB' }}>
        <h2 id="recent-requests-title" style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Solicitações recentes
        </h2>
        <div role="group" aria-label="Filtrar solicitações" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
          {FILTERS.map(([value, label]) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(value)}
                style={{
                  border: `1px solid ${active ? '#111827' : '#D1D5DB'}`,
                  background: active ? '#111827' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#374151',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {label} · {counts[value]}
              </button>
            );
          })}
        </div>
      </header>

      {rows.length === 0 ? (
        <p style={{ margin: 0, padding: '16px 14px', color: '#6B7280', fontSize: '13px' }}>
          {snapshot ? 'Nenhuma solicitação neste filtro.' : 'Aguardando o estado da operação…'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', flex: 1 }}>
          {rows.map((row) => (
            <RequestRow
              key={row.id}
              row={row}
              now={now}
              highlighted={row.externalReference === highlighted}
              onSelect={onSelectPoint ? () => onSelectPoint(row.pointId) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface RequestRowProps {
  row: RecentRequestRow;
  now: number;
  highlighted: boolean;
  onSelect?: () => void;
}

// Desenha uma linha clicável com status, ponto, coletor e há quanto tempo mudou.
function RequestRow({ row, now, highlighted, onSelect }: RequestRowProps) {
  const tone = STATUS_COLORS[row.status];
  return (
    <li style={{ borderBottom: '1px solid #F3F4F6' }}>
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        title={onSelect ? 'Mostrar no mapa' : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '2px 10px',
          width: '100%',
          padding: '9px 14px',
          border: 0,
          textAlign: 'left',
          cursor: onSelect ? 'pointer' : 'default',
          background: highlighted ? '#FEF9C3' : 'transparent',
          transition: 'background-color 600ms ease',
          font: 'inherit',
        }}
      >
        <strong style={{ fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.pointName}
        </strong>
        <span
          style={{
            justifySelf: 'end',
            color: tone.text,
            background: tone.background,
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {translateStatus(row.status)}
        </span>
        <span style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.collectorName ?? 'Aguardando coletor'}
        </span>
        <span style={{ justifySelf: 'end', fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
          {formatAge(row.updatedAt, now)}
        </span>
      </button>
    </li>
  );
}
