import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { translateStatus, type RequestStatus } from '@ecorota/shared';
import { Button, buttonClasses } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { StatusBadge } from '../../../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/StateView';
import { api, type PickupIssueReport } from '../api';
import { useTasks } from '../api/hooks';
import { FailedPickupFlow } from '../components/FailedPickupFlow';
import { CancelFlow } from '../components/CancelFlow';
import { ACTIVE_STATUSES, CANCELABLE_STATUSES, COMPLETABLE_STATUSES, ISSUE_STATUSES, materialLabel } from '../config';
import { formatDateBR, formatTime } from '../lib/dates';
import { MESSAGES, friendlyError, statusOf } from '../lib/messages';
import { STATUS_HINT } from '../lib/statusCopy';

type Notice = { tone: 'success' | 'error'; text: string };

// Detalhe da coleta + confirmar/cancelar.
//  - Confirmar (RF10): só com status in_service (regra do guia de integração); pede 1 confirmação.
//  - Cancelar (RF11): dupla confirmação (RN01).
//  - Não deu para coletar: registra o motivo (do ponto) e remarca ou encerra, sem sair da tela.
export default function DetalheColetaPage() {
  const { id } = useParams();
  const list = useTasks({
    poll: true,
    // Enquanto a coleta está ativa (ou ainda não carregou), acompanha a mudança de status.
    pollWhile: (data) => {
      const t = data?.find((x) => x.id === id);
      return !t || ACTIVE_STATUSES.includes(t.status);
    },
  });
  const task = list.data?.find((t) => t.id === id);
  const status = task?.status;

  const [announcement, setAnnouncement] = useState('');
  const previousStatus = useRef<RequestStatus | undefined>(status);
  useEffect(() => {
    if (status && previousStatus.current && status !== previousStatus.current) {
      setAnnouncement(`Sua coleta agora está: ${translateStatus(status)}`);
    }
    previousStatus.current = status;
  }, [status]);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  async function confirmComplete() {
    setCompleting(true);
    try {
      await api.completeTask(id!);
      setNotice({ tone: 'success', text: 'Coleta confirmada. Bom trabalho!' });
    } catch (e) {
      setNotice({ tone: 'error', text: statusOf(e) === 409 ? MESSAGES.notOnSite : friendlyError(e, MESSAGES.actionError) });
    } finally {
      setCompleting(false);
      setCompleteOpen(false);
      list.refresh();
    }
  }

  async function confirmCancel() {
    setCancelling(true);
    try {
      await api.cancelTask(id!);
      setNotice({ tone: 'success', text: 'Coleta cancelada.' });
    } catch (e) {
      setNotice({ tone: 'error', text: statusOf(e) === 409 ? MESSAGES.cannotCancel : friendlyError(e, MESSAGES.actionError) });
    } finally {
      setCancelling(false);
      setCancelOpen(false);
      list.refresh();
    }
  }

  async function confirmIssue(report: PickupIssueReport) {
    setReporting(true);
    try {
      await api.reportIssue(id!, report);
      setNotice({
        tone: 'success',
        text: report.rescheduleDate
          ? `Registrado. A coleta ficou para ${formatDateBR(report.rescheduleDate)}.`
          : 'Registrado. A coleta foi encerrada.',
      });
    } catch (e) {
      setNotice({ tone: 'error', text: statusOf(e) === 409 ? MESSAGES.notOnSite : friendlyError(e, MESSAGES.actionError) });
    } finally {
      setReporting(false);
      setIssueOpen(false);
      list.refresh();
    }
  }

  const back = (
    <Link to="/coletor" className={buttonClasses('ghost', false, 'lg')}>
      <Icon name="arrowLeft" />
      Voltar
    </Link>
  );

  if (list.loading && list.data === undefined) {
    return (
      <div className="space-y-section">
        {back}
        <PageTitle>Coleta</PageTitle>
        <LoadingState label="Carregando a coleta…" />
      </div>
    );
  }
  if (list.error && list.data === undefined) {
    return (
      <div className="space-y-section">
        {back}
        <PageTitle>Coleta</PageTitle>
        <ErrorState message={friendlyError(list.error)} onRetry={list.reload} />
      </div>
    );
  }
  if (!task) {
    return (
      <div className="space-y-section">
        {back}
        <PageTitle>Coleta</PageTitle>
        <EmptyState
          title="Não achamos essa coleta."
          action={
            <Link to="/coletor" className={buttonClasses('primary', false, 'lg')}>
              Ver coletas de hoje
            </Link>
          }
        />
      </div>
    );
  }

  const canComplete = COMPLETABLE_STATUSES.includes(task.status);
  const canCancel = CANCELABLE_STATUSES.includes(task.status);
  const canReportIssue = ISSUE_STATUSES.includes(task.status);
  const isActionable = task.status === 'assigned' || task.status === 'in_service';
  const isClosed = task.status === 'completed' || task.status === 'cancelled';

  return (
    <div className="space-y-section">
      {back}
      <PageTitle>Coleta</PageTitle>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
      {!!list.error && <InlineNotice tone="warning">Não deu para atualizar. Tentando de novo…</InlineNotice>}

      <section className="space-y-2 rounded-lg border-2 border-neutral-300 bg-neutral-0 p-4 shadow-card">
        <StatusBadge status={task.status} size="lg" />
        <p className="text-lg text-neutral-900">{STATUS_HINT[task.status]}</p>
      </section>

      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-0 px-4 shadow-card">
        <Item label="Material esperado" big>
          {task.materials.map(materialLabel).join(', ')}
        </Item>
        <Item label="Ponto de coleta">
          {task.pointName}
          <span className="block text-base font-normal text-neutral-700">Circuito {task.circuit}</span>
        </Item>
        <Item label="Data">{formatDateBR(task.scheduledDate)}</Item>
        {task.notes && <Item label="Observações">{task.notes}</Item>}
      </dl>
      <p className="text-base text-neutral-700">Atualizado às {formatTime(task.updatedAt)}</p>

      {isActionable && (
        <div className="space-y-3">
          {canComplete ? (
            <Button size="lg" fullWidth icon={<Icon name="check" />} onClick={() => setCompleteOpen(true)}>
              Confirmar coleta
            </Button>
          ) : (
            <div className="space-y-2">
              {/* aria-disabled (e não disabled): continua focável e o motivo é lido junto */}
              <Button
                size="lg"
                fullWidth
                icon={<Icon name="check" />}
                aria-disabled="true"
                aria-describedby="complete-reason"
                onClick={(e) => e.preventDefault()}
              >
                Confirmar coleta
              </Button>
              <p id="complete-reason" className="text-base text-neutral-800">
                Disponível quando você estiver no local.
              </p>
            </div>
          )}
          {canReportIssue && (
            <Button size="lg" variant="secondary" fullWidth icon={<Icon name="alert" />} onClick={() => setIssueOpen(true)}>
              Não deu para coletar
            </Button>
          )}
          {canCancel && (
            <Button size="lg" variant="danger" fullWidth icon={<Icon name="ban" />} onClick={() => setCancelOpen(true)}>
              Cancelar coleta
            </Button>
          )}
        </div>
      )}

      {isClosed && (
        <Link to="/coletor" className={buttonClasses('primary', true, 'lg')}>
          Voltar para hoje
        </Link>
      )}

      <ConfirmDialog
        open={completeOpen}
        title="Confirmar que a coleta foi feita?"
        cancelLabel="Voltar"
        confirmLabel="Sim, confirmar coleta"
        loading={completing}
        onCancel={() => setCompleteOpen(false)}
        onConfirm={confirmComplete}
      >
        Depois de confirmada, não dá para desfazer.
      </ConfirmDialog>

      <CancelFlow open={cancelOpen} loading={cancelling} onClose={() => setCancelOpen(false)} onConfirm={confirmCancel} />

      <FailedPickupFlow open={issueOpen} loading={reporting} onClose={() => setIssueOpen(false)} onConfirm={confirmIssue} />
    </div>
  );
}

function Item({ label, big, children }: { label: string; big?: boolean; children: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-base text-neutral-700">{label}</dt>
      <dd className={`font-bold text-neutral-900 ${big ? 'text-2xl' : 'text-lg'}`}>{children}</dd>
    </div>
  );
}
