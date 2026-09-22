import { useEffect, useRef, useState } from 'react';
import { translateStatus, type RequestStatus } from '@ecorota/shared';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { EmptyState, ErrorState, LoadingState } from '../../../components/StateView';
import { useTasks } from '../api/hooks';
import { TaskCard } from '../components/TaskCard';
import { ACTIVE_STATUSES } from '../config';
import { formatToday } from '../lib/dates';
import { friendlyError } from '../lib/messages';

// Painel do dia: as coletas atribuídas a mim, com as que exigem ação primeiro.
export default function PainelDiaPage() {
  const tasks = useTasks({
    poll: true,
    pollWhile: (data) => !data || data.some((t) => ACTIVE_STATUSES.includes(t.status)),
  });

  // Leitor de tela: avisa quando uma coleta muda de status (ex.: "Coletor no local" → já dá para confirmar).
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<Map<string, RequestStatus>>();
  useEffect(() => {
    if (!tasks.data) return;
    if (previous.current) {
      for (const t of tasks.data) {
        const before = previous.current.get(t.id);
        if (before && before !== t.status) setAnnouncement(`A coleta em ${t.pointName} agora está: ${translateStatus(t.status)}`);
      }
    }
    previous.current = new Map(tasks.data.map((t) => [t.id, t.status]));
  }, [tasks.data]);

  const all = tasks.data ?? [];
  const inService = all.filter((t) => t.status === 'in_service');
  const toDo = all.filter((t) => t.status === 'assigned' || t.status === 'pending');
  const closed = all.filter((t) => t.status === 'completed' || t.status === 'cancelled');
  const pendingCount = inService.length + toDo.length;

  return (
    <div className="space-y-section">
      <div className="space-y-1">
        <PageTitle>Hoje</PageTitle>
        <p className="text-lg text-neutral-700">{formatToday()}</p>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {tasks.loading && tasks.data === undefined ? (
        <LoadingState label="Carregando suas coletas…" />
      ) : tasks.error && tasks.data === undefined ? (
        <ErrorState message={friendlyError(tasks.error)} onRetry={tasks.reload} />
      ) : all.length === 0 ? (
        <EmptyState title="Nenhuma coleta para hoje." description="Quando um pedido for atribuído a você, ele aparece aqui." />
      ) : (
        <>
          {!!tasks.error && <InlineNotice tone="warning">Não deu para atualizar. Tentando de novo…</InlineNotice>}

          {pendingCount > 0 ? (
            <p className="text-2xl font-bold text-neutral-900">
              {pendingCount} {pendingCount === 1 ? 'coleta para fazer' : 'coletas para fazer'}
            </p>
          ) : (
            <InlineNotice tone="success">Tudo feito por hoje. Bom trabalho!</InlineNotice>
          )}

          <Section title="No local" tasks={inService} />
          <Section title="A caminho" tasks={toDo} />
          <Section title="Encerradas" tasks={closed} />
        </>
      )}
    </div>
  );
}

function Section({ title, tasks }: { title: string; tasks: ReturnType<typeof useTasks>['data'] }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <ul className="space-y-3">
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskCard task={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
