import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { ErrorState, LoadingState } from '../../../components/StateView';
import type { SessionUser } from '../../../lib/session';
import { usePoints } from '../api/hooks';
import { checkCollectorSession, logoutCollector } from '../lib/collectorAuth';
import { MESSAGES, friendlyError } from '../lib/messages';
import { levelFor } from '../lib/pointsCopy';

// Perfil do coletor: quem está logado, os pontos acumulados e a saída da conta.
// "Sair" pede confirmação para não ser tocado sem querer.
export default function PerfilPage() {
  const [collector, setCollector] = useState<SessionUser>();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string>();
  const points = usePoints();

  // RequireCollector já garantiu a sessão; aqui só busca os dados pra mostrar.
  useEffect(() => {
    void checkCollectorSession().then((result) => {
      if (result.kind === 'autorizado') setCollector(result.user);
    });
  }, []);

  async function confirmLogout() {
    setLeaving(true);
    try {
      await logoutCollector();
      navigate('/coletor/login', { replace: true });
    } catch (e) {
      setError(friendlyError(e, MESSAGES.actionError));
      setLeaving(false);
      setConfirmOpen(false);
    }
  }

  const level = points.data ? levelFor(points.data.balance) : null;

  return (
    <div className="space-y-section">
      <PageTitle>Perfil</PageTitle>

      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-0 px-4 shadow-card">
        <div className="py-3">
          <dt className="text-base text-neutral-700">Nome</dt>
          <dd className="text-2xl font-bold text-neutral-900">{collector?.nome}</dd>
        </div>
        <div className="py-3">
          <dt className="text-base text-neutral-700">E-mail</dt>
          <dd className="text-lg font-bold text-neutral-900">{collector?.email}</dd>
        </div>
      </dl>

      <section aria-labelledby="points-title" className="space-y-3">
        <h2 id="points-title" className="text-lg font-bold text-neutral-900">
          Seus pontos
        </h2>

        {points.loading && !points.data ? (
          <LoadingState label="Carregando seus pontos…" rows={1} />
        ) : points.error && !points.data ? (
          <ErrorState message={friendlyError(points.error)} onRetry={points.reload} />
        ) : points.data && level ? (
          <>
            <div className="flex items-center gap-4 rounded-lg border-2 border-reward-600 bg-reward-50 p-4 shadow-card">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-reward-600 text-white">
                <Icon name="star" className="h-7 w-7" />
              </span>
              <div>
                <p className="text-3xl font-bold text-neutral-900">{points.data.balance} pontos</p>
                <p className="text-base text-neutral-700">
                  Nível {level.label}
                  {level.next !== null ? ` · faltam ${level.next - points.data.balance} para o próximo nível` : ' · nível máximo'}
                </p>
              </div>
            </div>

            {points.data.entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-0 p-4 text-base text-neutral-700">
                Nenhuma coleta concluída ainda. Os pontos aparecem aqui assim que você confirmar a primeira.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-0 px-4 shadow-card">
                {points.data.entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="text-base font-semibold text-neutral-900">{entry.reason}</p>
                      <p className="text-sm text-neutral-700">{new Date(entry.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-reward-700">+{entry.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>

      <Button size="lg" variant="secondary" fullWidth icon={<Icon name="logout" />} onClick={() => setConfirmOpen(true)}>
        Sair da conta
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Sair da conta?"
        cancelLabel="Ficar no app"
        confirmLabel="Sim, sair"
        confirmVariant="danger"
        loading={leaving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmLogout}
      >
        Para ver suas coletas de novo, você vai precisar entrar outra vez.
      </ConfirmDialog>
    </div>
  );
}
