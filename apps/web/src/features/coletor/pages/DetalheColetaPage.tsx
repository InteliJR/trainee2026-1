import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { translateStatus, type RequestStatus } from '@ecorota/shared';
import { Button, buttonClasses } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { StatusBadge } from '../../../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/StateView';
import { api, USE_MOCK } from '../api';
import { useTasks } from '../api/hooks';
import { FailedPickupFlow } from '../components/FailedPickupFlow';
import { CancelFlow } from '../components/CancelFlow';
import { CompleteFlow } from '../components/CompleteFlow';
import { ACTIVE_STATUSES, CANCELABLE_STATUSES, COMPLETABLE_STATUSES, ISSUE_STATUSES, STARTABLE_STATUSES, materialLabel } from '../config';
import { formatAddress, formatDistrict } from '../lib/address';
import { formatDateBR, formatTime } from '../lib/dates';
import { MESSAGES, friendlyError, statusOf } from '../lib/messages';
import { STATUS_HINT } from '../lib/statusCopy';

type Notice = { tone: 'success' | 'error'; text: string };

// A API não tem upload de foto — não haverá tela pra isso. `fotoUrl` é obrigatória no endpoint
// de conclusão, então manda um valor fixo (produto decidiu: sem captura de foto no app).
const PLACEHOLDER_PHOTO_URL = 'https://ecorota.example/sem-foto.jpg';

// Detalhe da coleta.
//  - Iniciar atendimento (assigned -> in_service): exigido pela API real antes de poder confirmar.
//  - Confirmar (RF10): dupla confirmação (CompleteFlow), conectada à API real.
//  - Cancelar (RF11) e "Não deu para coletar": a API real só deixa o MORADOR cancelar — o coletor
//    não tem essa ação fora do mock.
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

  const [starting, setStarting] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  async function handleStart() {
    setStarting(true);
    try {
      await api.startTask(id!);
      setNotice({ tone: 'success', text: 'Atendimento iniciado.' });
    } catch (e) {
      setNotice({ tone: 'error', text: statusOf(e) === 409 ? MESSAGES.notAssigned : friendlyError(e, MESSAGES.actionError) });
    } finally {
      setStarting(false);
      list.refresh();
    }
  }

  async function confirmComplete() {
    setCompleting(true);
    try {
      await api.completeTask(id!, PLACEHOLDER_PHOTO_URL);
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
      await api.cancelTask(id!, 'Cancelado pelo coletor');
      setNotice({ tone: 'success', text: 'Coleta cancelada.' });
    } catch (e) {
      setNotice({ tone: 'error', text: statusOf(e) === 409 ? MESSAGES.cannotCancel : friendlyError(e, MESSAGES.actionError) });
    } finally {
      setCancelling(false);
      setCancelOpen(false);
      list.refresh();
    }
  }

  async function confirmIssue(reason: string) {
    setReporting(true);
    try {
      await api.cancelTask(id!, reason);
      setNotice({ tone: 'success', text: 'Registrado. A coleta foi encerrada.' });
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

  const canStart = STARTABLE_STATUSES.includes(task.status);
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
        <Item label="Endereço">
          {formatAddress(task.address)}
          <span className="block text-base font-normal text-neutral-700">{formatDistrict(task.address)}</span>
        </Item>
        <Item label="Data">{formatDateBR(task.scheduledDate)}</Item>
        {task.notes && <Item label="Observações">{task.notes}</Item>}
      </dl>
      <p className="text-base text-neutral-700">Atualizado às {formatTime(task.updatedAt)}</p>

      {isActionable && (
        <div className="space-y-3">
          {canStart && (
            <Button size="lg" fullWidth icon={<Icon name="pin" />} loading={starting} loadingText="Iniciando…" onClick={handleStart}>
              Iniciar atendimento
            </Button>
          )}

          {canComplete && (
            <Button size="lg" fullWidth icon={<Icon name="check" />} onClick={() => setCompleteOpen(true)}>
              Confirmar coleta
            </Button>
          )}

          {canReportIssue && USE_MOCK && (
            <Button size="lg" variant="secondary" fullWidth icon={<Icon name="alert" />} onClick={() => setIssueOpen(true)}>
              Não deu para coletar
            </Button>
          )}

          {canCancel && USE_MOCK && (
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

      <CompleteFlow open={completeOpen} loading={completing} onClose={() => setCompleteOpen(false)} onConfirm={confirmComplete} />

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
