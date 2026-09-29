import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { ErrorState, LoadingState } from '../../../components/StateView';
import { useAvailability } from '../api/hooks';
import { SYNC_STATUS_COPY } from '../lib/availabilityCopy';
import { formatTime } from '../lib/dates';
import { friendlyError } from '../lib/messages';

// Disponibilidade (Task 3.4, Dia 5): liga/desliga o recebimento de novas coletas
// (arquitetura-Luiz.md §10.2: POST /collector/availability). Ficar indisponível pede confirmação
// (toque acidental faria o coletor parar de receber coletas); voltar a ficar disponível é direto.
export default function DisponibilidadePage() {
  const { data: availability, loading, error, toggling, toggleError, reload, toggle } = useAvailability();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<boolean>();
  useEffect(() => {
    if (!availability) return;
    if (previous.current !== undefined && previous.current !== availability.available) {
      setAnnouncement(availability.available ? 'Você está disponível.' : 'Você está indisponível.');
    }
    previous.current = availability.available;
  }, [availability]);

  return (
    <div className="space-y-section">
      <PageTitle>Disponível</PageTitle>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {loading && !availability ? (
        <LoadingState label="Carregando disponibilidade…" rows={1} />
      ) : error && !availability ? (
        <ErrorState message={friendlyError(error)} onRetry={reload} />
      ) : availability ? (
        <>
          {!!toggleError && <InlineNotice tone="error">{friendlyError(toggleError, 'Não deu para atualizar. Tente de novo.')}</InlineNotice>}

          <section
            className={`space-y-2 rounded-lg border-2 p-4 shadow-card ${
              availability.available ? 'border-brand-600 bg-brand-50' : 'border-neutral-400 bg-neutral-100'
            }`}
          >
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold ${
                availability.available ? 'bg-brand-600 text-white' : 'bg-neutral-600 text-white'
              }`}
            >
              <Icon name={availability.available ? 'checkCircle' : 'ban'} className="h-6 w-6" />
              {availability.available ? 'Disponível' : 'Indisponível'}
            </span>
            <p className="text-lg text-neutral-900">
              {availability.available ? 'Você está recebendo novas coletas.' : 'Você não vai receber novas coletas.'}
            </p>
            <p className="text-sm text-neutral-700">Atualizado às {formatTime(availability.updatedAt)}</p>
          </section>

          {/* Sincronização: a EcoRota é quem de fato distribui as coletas — esse status diz se ela já sabe da mudança. */}
          <InlineNotice tone={SYNC_STATUS_COPY[availability.syncStatus].tone}>
            <p className="font-semibold">{SYNC_STATUS_COPY[availability.syncStatus].title}</p>
            <p className="mt-1 font-normal">{SYNC_STATUS_COPY[availability.syncStatus].text}</p>
          </InlineNotice>

          <Button
            size="lg"
            fullWidth
            variant={availability.available ? 'danger' : 'primary'}
            icon={<Icon name={availability.available ? 'ban' : 'checkCircle'} />}
            loading={toggling}
            loadingText="Atualizando…"
            onClick={() => (availability.available ? setConfirmOpen(true) : toggle())}
          >
            {availability.available ? 'Ficar indisponível' : 'Ficar disponível'}
          </Button>

          <section className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-card">
            <h2 className="text-base font-bold text-neutral-900">O que isso muda?</h2>
            <p className="flex items-start gap-2 text-base text-neutral-800">
              <Icon name="checkCircle" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
              <span><strong>Disponível:</strong> você pode ser escalado para novas coletas a qualquer momento.</span>
            </p>
            <p className="flex items-start gap-2 text-base text-neutral-800">
              <Icon name="ban" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-600" />
              <span>
                <strong>Indisponível:</strong> você para de receber coletas novas. As que já estão com você continuam
                normalmente, dá pra terminar mesmo indisponível.
              </span>
            </p>
          </section>

          <ConfirmDialog
            open={confirmOpen}
            title="Ficar indisponível?"
            cancelLabel="Continuar disponível"
            confirmLabel="Sim, ficar indisponível"
            confirmVariant="danger"
            loading={toggling}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={async () => {
              await toggle();
              setConfirmOpen(false);
            }}
          >
            Você não vai receber novas coletas até ficar disponível de novo.
          </ConfirmDialog>
        </>
      ) : null}
    </div>
  );
}
