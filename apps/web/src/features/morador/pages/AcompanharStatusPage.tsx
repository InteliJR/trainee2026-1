import { translateStatus, type RequestStatus } from '@ecorota/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTempoReal } from '../../../realtime/useTempoReal';
import { EcoPageHeader } from '../components/EcoPageHeader';
import { Icon } from '../components/Icon';
import { ResidentBottomNav } from '../components/ResidentBottomNav';
import { ResidentLiveMap } from '../components/ResidentLiveMap';
import { cancelResidentRequest, getResidentRequests, refreshResidentRequests } from '../lib/residentRequests';
import {
  applyLiveToRequest,
  isTrackable,
  residentRequestKey,
  resolveResidentLive,
  type ResidentLiveInfo,
} from '../lib/residentLive';
import type { ResidentCollectionRequest } from '../types';

const statusOrder: RequestStatus[] = ['pending', 'assigned', 'in_service', 'completed'];

const statusTone: Record<RequestStatus, string> = {
  pending: 'bg-reward-100 text-reward-900',
  assigned: 'bg-operational-100 text-operational-800',
  in_service: 'bg-brand-100 text-brand-700',
  completed: 'bg-brand-600 text-white',
  cancelled: 'bg-neutral-200 text-neutral-600',
};

const statusHelper: Record<RequestStatus, string> = {
  pending: 'Estamos procurando um coletor disponível para o horário escolhido.',
  assigned: 'Um coletor assumiu a coleta e está a caminho.',
  in_service: 'O coletor chegou ao local combinado.',
  completed: 'Coleta finalizada. Seu impacto já pode aparecer no histórico.',
  cancelled: 'Esta coleta foi cancelada e permanece registrada no histórico.',
};

export function AcompanharStatusPage() {
  const [residentRequests, setResidentRequests] = useState(getResidentRequests);
  const [selectedRequestId, setSelectedRequestId] = useState(residentRequests[0]?.id ?? '');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelledIds, setCancelledIds] = useState<string[]>([]);
  const [cancelError, setCancelError] = useState('');
  // Recebe pelo Socket.IO o status das solicitações do morador e a posição do coletor que o atende.
  const realtime = useTempoReal({});

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const latest = await refreshResidentRequests();
      if (active && latest) setResidentRequests(latest);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const requests = useMemo(
    () =>
      residentRequests.map((request) =>
        cancelledIds.includes(request.id)
          ? { ...request, status: 'cancelled' as const }
          // Aplica o status ao vivo; sem conexão ou sem a solicitação no snapshot, mantém o dado local.
          : applyLiveToRequest(request, resolveResidentLive(realtime.snapshot, residentRequestKey(request))),
      ),
    [cancelledIds, residentRequests, realtime.snapshot],
  );

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? requests[0];
  const selectedLive = selectedRequest
    ? resolveResidentLive(realtime.snapshot, residentRequestKey(selectedRequest))
    : null;
  const isLive = realtime.connectionStatus === 'conectado';

  async function cancelSelectedRequest() {
    if (!selectedRequest) {
      return;
    }

    setCancelError('');
    try {
      // Cancela na API quando a solicitação é real; a tela só muda depois da confirmação.
      await cancelResidentRequest(selectedRequest);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Não foi possível cancelar a coleta.');
      return;
    }
    setCancelledIds((previous) =>
      previous.includes(selectedRequest.id) ? previous : [...previous, selectedRequest.id],
    );
    setResidentRequests(getResidentRequests());
    setShowCancelConfirm(false);
  }

  return (
    <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
      <div className="mx-auto grid max-w-dashboard gap-section lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="space-y-4" aria-labelledby="requests-title">
          <EcoPageHeader
            description="Acompanhe cada coleta como uma rota de renovação: pedido, coletor, chegada e conclusão."
            eyebrow="Morador"
            metric={`${requests.length}`}
            metricLabel="coletas"
            title="Acompanhar status"
          />

          {isLive ? (
            <p role="status" className="flex items-center gap-2 text-sm font-semibold text-brand-700">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-600" />
              Atualizando ao vivo
            </p>
          ) : null}

          <div className="grid gap-3">
            {requests.map((request) => (
              <RequestListButton
                isSelected={request.id === selectedRequest.id}
                key={request.id}
                onSelect={() => {
                  setSelectedRequestId(request.id);
                  setShowCancelConfirm(false);
                  setCancelError('');
                }}
                request={request}
              />
            ))}
          </div>
        </section>

        {selectedRequest ? (
          <StatusDetail
            live={selectedRequest.status === 'cancelled' ? null : selectedLive}
            cancelError={cancelError}
            onCancel={() => void cancelSelectedRequest()}
            onCancelIntent={() => setShowCancelConfirm(true)}
            onKeepRequest={() => {
              setShowCancelConfirm(false);
              setCancelError('');
            }}
            request={selectedRequest}
            showCancelConfirm={showCancelConfirm}
          />
        ) : (
          <EmptyState />
        )}
      </div>
      <ResidentBottomNav activeItem="status" />
    </main>
  );
}

interface RequestListButtonProps {
  request: ResidentCollectionRequest;
  isSelected: boolean;
  onSelect: () => void;
}

function RequestListButton({ request, isSelected, onSelect }: RequestListButtonProps) {
  return (
    <button
      className={[
        'rounded-lg p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
        isSelected ? 'eco-card-selected' : 'eco-card hover:border-brand-300',
      ].join(' ')}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase text-earth-600">{request.protocol}</span>
          <h2 className="mt-1 text-base font-bold text-neutral-950">{request.materialName}</h2>
          <p className="mt-1 text-sm text-neutral-600">{request.pointName}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
        <Icon name="leaf" className="h-4 w-4 text-brand-700" />
        {request.scheduledDate} - {request.shiftLabel}
      </div>
    </button>
  );
}

interface StatusDetailProps {
  request: ResidentCollectionRequest;
  live: ResidentLiveInfo | null;
  cancelError: string;
  showCancelConfirm: boolean;
  onCancelIntent: () => void;
  onCancel: () => void;
  onKeepRequest: () => void;
}

function StatusDetail({
  request,
  live,
  cancelError,
  showCancelConfirm,
  onCancelIntent,
  onCancel,
  onKeepRequest,
}: StatusDetailProps) {
  const canCancel = request.status === 'pending' || request.status === 'assigned';
  const activeStepIndex = request.status === 'cancelled' ? -1 : statusOrder.indexOf(request.status);

  return (
    <section className="eco-panel rounded-lg p-4 sm:p-6" aria-labelledby="status-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="eco-icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
            <Icon name="cycle" className="h-6 w-6" />
          </span>
          <div>
          <p className="text-sm font-semibold uppercase text-brand-700">{request.protocol}</p>
          <h2 id="status-title" className="mt-1 text-2xl font-bold text-neutral-950">
            {translateStatus(request.status)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{statusHelper[request.status]}</p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="mt-6 grid gap-4 border-y border-neutral-200 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem icon="trash" label="Material" value={request.materialName} />
        <InfoItem icon="map-pin" label="Ponto" value={request.pointName} />
        <InfoItem icon="calendar" label="Data" value={request.scheduledDate} />
        <InfoItem icon="clock" label="Turno" value={`${request.shiftLabel} (${request.shiftWindow})`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-neutral-950">
            <Icon name="route" className="h-5 w-5 text-brand-700" />
            Linha do tempo
          </h3>
          <ol className="mt-4 grid gap-4">
            {request.timeline.map((item) => {
              const itemIndex = statusOrder.indexOf(item.status);
              const isDone = request.status === 'completed' || itemIndex <= activeStepIndex;
              const isCurrent = item.status === request.status;

              return (
                <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3" key={item.status}>
                  <span
                    className={[
                      'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border',
                      isDone
                        ? 'border-brand-600 bg-brand-600 text-white shadow-card'
                        : 'border-neutral-200 bg-earth-50 text-earth-600',
                    ].join(' ')}
                  >
                    <Icon name={isDone ? 'check' : 'leaf'} className="h-4 w-4" />
                  </span>
                  <span className="border-b border-neutral-200 pb-4">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-neutral-950">{item.label}</strong>
                      {isCurrent ? (
                        <span className="rounded-full bg-operational-100 px-2 py-1 text-xs font-semibold text-operational-800">
                          Agora
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-neutral-600">{item.description}</span>
                    <span className="mt-1 block text-xs font-semibold text-neutral-500">
                      {item.occurredAt ?? 'Ainda não aconteceu'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="border-t border-neutral-200 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-neutral-950">
            <Icon name="truck" className="h-5 w-5 text-brand-700" />
            Coletor
          </h3>
          {request.collectorName ? (
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="block text-neutral-500">Nome</span>
                <strong className="text-neutral-950">{request.collectorName}</strong>
              </p>
              <p>
                <span className="block text-neutral-500">Chegada prevista</span>
                <strong className="text-neutral-950">{request.estimatedArrival ?? 'Sem previsão'}</strong>
              </p>
              <p className="flex items-center gap-2 text-neutral-700">
                <Icon name="phone" className="h-4 w-4 text-operational-700" />
                {request.collectorPhone}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-neutral-600">
              Ainda não há coletor responsável. O status muda automaticamente quando alguém assumir.
            </p>
          )}

          <div className="mt-5 border-t border-neutral-200 pt-4 text-sm">
            <span className="block text-neutral-500">Pontos previstos</span>
            <strong className="mt-1 block text-reward-800">+{request.pointsPreview} pontos</strong>
          </div>
        </aside>
      </div>

      {isTrackable(live) ? <ResidentLiveMap point={live.point} collector={live.collector} /> : null}

      {request.status === 'completed' ? (
        <div role="status" className="mt-6 rounded-lg border border-neutral-200 bg-brand-50 p-4">
          <div aria-hidden="true" className="eco-confetti"><span>✦</span><span>✳</span><span>✦</span><span>✳</span><span>✦</span></div>
          <p className="text-center text-sm font-bold text-brand-700">Coleta concluída! Seu impacto já está no histórico.</p>
        </div>
      ) : null}

      {canCancel && request.status !== 'cancelled' ? (
        <div className="mt-6 border-t border-neutral-200 pt-4">
          {showCancelConfirm ? (
            <div className="grid gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <p className="text-sm leading-6 text-danger-800">
                Tem certeza? Cancelar remove esta coleta da fila, mas ela continua no histórico.
              </p>
              <button
                className="eco-secondary-button inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-bold text-neutral-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500"
                onClick={onKeepRequest}
                type="button"
              >
                Manter
              </button>
              <button
                className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-danger-600 px-4 text-sm font-bold text-white transition hover:bg-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600"
                onClick={onCancel}
                type="button"
              >
                <Icon name="x" className="h-4 w-4" />
                Cancelar
              </button>
              {cancelError ? (
                <p role="alert" className="text-sm font-semibold text-danger-800 sm:col-span-3">
                  {cancelError}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              className="eco-secondary-button inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-danger-600 px-4 text-sm font-bold text-danger-700 transition hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600"
              onClick={onCancelIntent}
              type="button"
            >
              <Icon name="x" className="h-4 w-4" />
              Cancelar coleta
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

interface InfoItemProps {
  icon: 'calendar' | 'clock' | 'map-pin' | 'trash';
  label: string;
  value: string;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
      <span>
        <span className="block text-neutral-500">{label}</span>
        <strong className="mt-1 block text-neutral-950">{value}</strong>
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={['rounded-full border border-white/70 px-3 py-1 text-xs font-bold shadow-card', statusTone[status]].join(' ')}>
      {translateStatus(status)}
    </span>
  );
}

function EmptyState() {
  return (
    <section className="eco-card rounded-lg p-6 text-sm leading-6 text-neutral-600">
      Nenhuma coleta encontrada. Solicite uma coleta para começar.
    </section>
  );
}
