import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { ErrorState, LoadingState } from '../../../components/StateView';
import { useAvailability } from '../api/hooks';
import { friendlyError } from '../lib/messages';

// Disponibilidade (Task 3.4, Dia 5): liga/desliga o recebimento de novas coletas
// (arquitetura-Luiz.md §10.2: POST /collector/availability). Ficar indisponível pede confirmação
// (toque acidental faria o coletor parar de receber coletas); voltar a ficar disponível é direto.
export default function DisponibilidadePage() {
  const { data: available, loading, error, toggling, toggleError, reload, toggle } = useAvailability();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<boolean>();
  useEffect(() => {
    if (available === undefined) return;
    if (previous.current !== undefined && previous.current !== available) {
      setAnnouncement(available ? 'Você está disponível.' : 'Você está indisponível.');
    }
    previous.current = available;
  }, [available]);

  return (
    <div className="space-y-section">
      <PageTitle>Disponível</PageTitle>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {loading && available === undefined ? (
        <LoadingState label="Carregando disponibilidade…" rows={1} />
      ) : error && available === undefined ? (
        <ErrorState message={friendlyError(error)} onRetry={reload} />
      ) : (
        <>
          {!!toggleError && <InlineNotice tone="error">{friendlyError(toggleError, 'Não deu para atualizar. Tente de novo.')}</InlineNotice>}

          <section
            className={`space-y-2 rounded-lg border-2 p-4 shadow-card ${
              available ? 'border-brand-600 bg-brand-50' : 'border-neutral-400 bg-neutral-100'
            }`}
          >
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold ${
                available ? 'bg-brand-600 text-white' : 'bg-neutral-600 text-white'
              }`}
            >
              <Icon name={available ? 'checkCircle' : 'ban'} className="h-6 w-6" />
              {available ? 'Disponível' : 'Indisponível'}
            </span>
            <p className="text-lg text-neutral-900">
              {available ? 'Você está recebendo novas coletas.' : 'Você não vai receber novas coletas.'}
            </p>
          </section>

          <Button
            size="lg"
            fullWidth
            variant={available ? 'danger' : 'primary'}
            icon={<Icon name={available ? 'ban' : 'checkCircle'} />}
            loading={toggling}
            loadingText="Atualizando…"
            onClick={() => (available ? setConfirmOpen(true) : toggle())}
          >
            {available ? 'Ficar indisponível' : 'Ficar disponível'}
          </Button>

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
      )}
    </div>
  );
}
