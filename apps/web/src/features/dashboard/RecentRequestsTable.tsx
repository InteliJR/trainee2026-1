/**
 * Tabela das solicitações mais recentes do painel operacional.
 * Lê o snapshot em tempo real, destaca por um instante a linha que acabou de mudar
 * e avisa o painel quando o operador escolhe uma linha, para o mapa centralizar no ponto.
 */
import { translateStatus } from '@ecorota/shared';
import { useEffect, useMemo, useState } from 'react';
import { formatAge } from '../../map/mapUtils';
import type { RealtimeRequestEvent, RealtimeRequestStatus, RealtimeSnapshot } from '../../realtime/socketClient';
import { countByFilter, selectRecentRequests, type RecentRequestRow, type RequestFilter } from './recentRequests';

// Rótulos dos filtros rápidos na ordem em que aparecem.
const FILTERS: Array<[RequestFilter, string]> = [
  ['todas', 'Todas'],
  ['ativas', 'Ativas'],
  ['concluidas', 'Concluídas'],
  ['canceladas', 'Canceladas'],
];

// Cores de status do guia (texto e fundo suave), escritas por inteiro para o Tailwind gerar as classes.
const STATUS_CLASSES: Record<RealtimeRequestStatus, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  assigned: 'bg-status-assigned-bg text-status-assigned',
  in_service: 'bg-status-in-service-bg text-status-in-service',
  completed: 'bg-status-completed-bg text-status-completed',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled',
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
    <section aria-labelledby="recent-requests-title" className="flex min-h-0 flex-1 flex-col bg-neutral-0">
      <header className="border-b border-neutral-200 px-4 pb-3 pt-3">
        <h2 id="recent-requests-title" className="text-lg font-bold text-neutral-900">
          Solicitações recentes
        </h2>
        <div role="group" aria-label="Filtrar solicitações" className="mt-2 flex flex-wrap gap-2">
          {FILTERS.map(([value, label]) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(value)}
                className={`inline-flex min-h-touch items-center rounded-full border px-3 text-sm font-semibold transition ${
                  active
                    ? 'border-operational-700 bg-operational-700 text-neutral-0'
                    : 'border-neutral-300 bg-neutral-0 text-neutral-700 hover:border-operational-600 hover:text-operational-700'
                }`}
              >
                {label} · {counts[value]}
              </button>
            );
          })}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-600">
          {snapshot ? 'Nenhuma solicitação neste filtro.' : 'Carregando solicitações…'}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
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
  return (
    <li className="border-b border-neutral-100">
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        title={onSelect ? 'Mostrar no mapa' : undefined}
        className={`grid min-h-touch w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-2.5 text-left transition-colors duration-500 enabled:hover:bg-operational-50 ${
          highlighted ? 'bg-reward-100' : 'bg-transparent'
        }`}
      >
        <strong className="truncate text-sm text-neutral-900">{row.pointName}</strong>
        <span className={`justify-self-end whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${STATUS_CLASSES[row.status]}`}>
          {translateStatus(row.status)}
        </span>
        <span className="truncate text-sm text-neutral-600">{row.collectorName ?? 'Aguardando coletor'}</span>
        <span className="justify-self-end whitespace-nowrap text-sm text-neutral-500">{formatAge(row.updatedAt, now)}</span>
      </button>
    </li>
  );
}
