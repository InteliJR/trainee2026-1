import { translateStatus } from '@ecorota/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EcoPageHeader } from '../components/EcoPageHeader';
import { Icon } from '../components/Icon';
import { ResidentBottomNav } from '../components/ResidentBottomNav';
import { getCachedResidentRequests, refreshResidentRequests } from '../lib/residentRequests';

export function InicioMoradorPage() {
  const [requests, setRequests] = useState(getCachedResidentRequests);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const latest = await refreshResidentRequests();
    if (latest) setRequests(latest);
    setStale(latest === null);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const completed = requests?.filter((request) => request.status === 'completed') ?? [];
  const active = requests?.filter((request) => ['pending', 'assigned', 'in_service'].includes(request.status)) ?? [];
  const current = active[0];

  return (
    <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
      <div className="mx-auto max-w-dashboard space-y-6">
        <EcoPageHeader
          eyebrow="Início do morador"
          title="Seu espaço EcoRota"
          description="Acompanhe suas coletas e veja o que você já realizou."
          metric={requests ? String(completed.length) : undefined}
          metricLabel="coletas concluídas"
        />

        {stale && requests && (
          <p role="status" className="rounded-lg border border-reward-200 bg-reward-50 p-3 text-sm text-reward-900">
            Exibindo o último resumo salvo neste aparelho. Os dados serão atualizados quando a conexão voltar.
          </p>
        )}

        {loading && !requests ? (
          <p role="status" className="eco-panel rounded-lg p-6 text-neutral-600">Carregando seu resumo…</p>
        ) : !requests ? (
          <section className="eco-panel rounded-lg p-6">
            <h2 className="text-xl font-bold">Seu resumo está indisponível</h2>
            <p className="mt-2 text-sm text-neutral-600">Conecte-se para carregar suas coletas.</p>
            <button type="button" onClick={() => void refresh()} className="eco-primary-button mt-4 min-h-touch rounded-md px-4 text-sm font-bold text-white">
              Tentar novamente
            </button>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo das suas coletas">
              <article className="eco-card rounded-lg p-5">
                <span className="eco-icon-tile flex h-11 w-11 items-center justify-center rounded-lg"><Icon name="check" className="h-6 w-6" /></span>
                <p className="mt-4 text-sm font-semibold text-neutral-600">Você já fez</p>
                <p className="mt-1 text-3xl font-bold">{completed.length} {completed.length === 1 ? 'coleta' : 'coletas'}</p>
                <p className="mt-2 text-sm text-neutral-600">Concluídas e registradas no seu histórico.</p>
              </article>
              <article className="eco-card rounded-lg p-5">
                <span className="eco-icon-tile flex h-11 w-11 items-center justify-center rounded-lg"><Icon name="route" className="h-6 w-6" /></span>
                <p className="mt-4 text-sm font-semibold text-neutral-600">Em aberto</p>
                <p className="mt-1 text-3xl font-bold">{active.length} {active.length === 1 ? 'coleta' : 'coletas'}</p>
                <p className="mt-2 text-sm text-neutral-600">Aguardando ou em atendimento.</p>
              </article>
            </section>

            <section className="eco-panel rounded-lg p-5 sm:p-6" aria-labelledby="current-request-title">
              <div className="flex items-start gap-3">
                <span className="eco-icon-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"><Icon name="calendar" className="h-5 w-5" /></span>
                <div>
                  <h2 id="current-request-title" className="text-xl font-bold">{current ? 'Sua coleta em aberto' : 'Pronto para a próxima coleta?'}</h2>
                  {current ? (
                    <p className="mt-2 text-sm text-neutral-700">
                      {current.materialName} · {new Date(`${current.scheduledDate}T12:00:00`).toLocaleDateString('pt-BR')} · {translateStatus(current.status)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-700">Separe seu material, escolha um ponto de coleta e o melhor dia.</p>
                  )}
                </div>
              </div>
              <Link to={current ? '/morador/acompanhar' : '/morador/solicitar'} className="eco-primary-button mt-5 inline-flex min-h-touch items-center gap-2 rounded-md px-4 text-sm font-bold text-white">
                {current ? 'Acompanhar coleta' : 'Solicitar coleta'} <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </section>
          </>
        )}

        <section className="grid gap-3 sm:grid-cols-2" aria-label="Acesso rápido">
          <Link to="/morador/solicitar" className="eco-card flex min-h-touch items-center gap-3 rounded-lg p-4 font-bold text-brand-700 hover:border-brand-300">
            <Icon name="trash" className="h-5 w-5" /> Nova coleta <Icon name="arrow-right" className="ml-auto h-4 w-4" />
          </Link>
          <Link to="/morador/historico" className="eco-card flex min-h-touch items-center gap-3 rounded-lg p-4 font-bold text-brand-700 hover:border-brand-300">
            <Icon name="history" className="h-5 w-5" /> Ver histórico <Icon name="arrow-right" className="ml-auto h-4 w-4" />
          </Link>
        </section>
      </div>
      <ResidentBottomNav activeItem="inicio" />
    </main>
  );
}
