import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, buttonClasses } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { InlineNotice } from '../../components/InlineNotice';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView';
import { ApiError } from '../../lib/api';
import type { BasicProfile } from '../profiles/profileApi';
import {
  assignCollector,
  describeMaterials,
  fetchAssignableRequests,
  fetchCollectors,
  type AssignableRequestDTO,
} from './assignmentsApi';
import { logoutOperator } from './operatorAuth';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (error.status === 0) return 'Sem conexão com a API. Verifique o servidor e tente novamente.';
    return error.message;
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Atribuição de coletores às solicitações feitas nos pontos da plataforma, que a EcoRota não atende.
export function AtribuicoesPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AssignableRequestDTO[]>([]);
  const [collectors, setCollectors] = useState<BasicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  // Coletor escolhido em cada solicitação e qual delas está sendo enviada.
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [awaiting, allCollectors] = await Promise.all([fetchAssignableRequests(), fetchCollectors()]);
      setRequests(awaiting);
      setCollectors(allCollectors);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        navigate('/operador/login', { replace: true, state: { from: '/dashboard/atribuicoes' } });
        return;
      }
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const available = collectors.filter((collector) => collector.disponivel);

  async function assign(request: AssignableRequestDTO) {
    const collectorId = choice[request.id];
    if (!collectorId) return;
    setAssigning(request.id);
    setAssignError((current) => ({ ...current, [request.id]: '' }));
    setFeedback('');
    try {
      await assignCollector(request.id, collectorId);
      const name = collectors.find((collector) => collector.id === collectorId)?.nome ?? 'O coletor';
      setFeedback(`${name} foi atribuído à coleta em ${request.pontoColeta?.nome ?? 'ponto sem nome'}.`);
      await load();
    } catch (error) {
      setAssignError((current) => ({ ...current, [request.id]: errorMessage(error) }));
    } finally {
      setAssigning(null);
    }
  }

  async function logout() {
    await logoutOperator().catch(() => undefined);
    navigate('/operador/login', { replace: true });
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 border-t-4 border-t-operational-600 bg-neutral-0 px-screen py-4 lg:px-6">
        <div className="mx-auto flex max-w-dashboard flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-operational-700">Operação EcoRota</p>
            <h1 className="text-2xl font-bold">Atribuir coletores</h1>
            <p className="mt-1 text-sm text-neutral-600">Solicitações feitas nos pontos da plataforma que esperam um coletor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className={buttonClasses('secondary')}>Visão operacional</Link>
            <Button variant="secondary" icon={<Icon name="logout" className="h-4 w-4" />} onClick={() => void logout()}>Sair</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-dashboard space-y-6 px-screen py-6 lg:px-6">
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Resumo das atribuições">
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi">
            <p className="text-sm text-neutral-600">Aguardando coletor</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-operational-700">{loading ? '—' : requests.length}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi">
            <p className="text-sm text-neutral-600">Coletores disponíveis</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-700">{loading ? '—' : `${available.length}/${collectors.length}`}</p>
          </div>
        </section>

        <InlineNotice tone="info">
          As solicitações dos pontos EcoRota são atribuídas pela própria EcoRota e não aparecem aqui. Só coletores marcados como disponíveis podem receber uma coleta.
        </InlineNotice>
        {feedback ? <InlineNotice tone="success">{feedback}</InlineNotice> : null}

        <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-card sm:p-5" aria-labelledby="awaiting-title">
          <h2 id="awaiting-title" className="text-lg font-semibold">Aguardando coletor</h2>
          <div className="mt-4">
            {loading ? (
              <LoadingState label="Carregando solicitações…" />
            ) : loadError ? (
              <ErrorState message={loadError} onRetry={() => void load()} />
            ) : requests.length === 0 ? (
              <EmptyState title="Nenhuma solicitação esperando coletor" description="Quando um morador pedir coleta num ponto da plataforma, ela aparece aqui." />
            ) : (
              <ul className="space-y-3">
                {requests.map((request) => (
                  <li key={request.id} className="rounded-lg border border-neutral-200 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-neutral-900">{request.pontoColeta?.nome ?? 'Ponto sem nome'}</p>
                        <p className="mt-1 text-sm text-neutral-700">{describeMaterials(request.materiais)}</p>
                        <p className="mt-1 text-sm text-neutral-600">
                          Desejada para {formatDate(request.dataDesejada)}
                          {request.pontoColeta ? ` · circuito ${request.pontoColeta.circuito}` : ''}
                          {' · pedida em '}{formatDate(request.criadoEm)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="min-w-0 flex-1 text-sm font-semibold text-neutral-800">
                          Coletor
                          <select
                            value={choice[request.id] ?? ''}
                            onChange={(event) => setChoice((current) => ({ ...current, [request.id]: event.target.value }))}
                            className="mt-1 block min-h-touch w-full rounded-md border border-neutral-400 bg-neutral-0 px-3 font-normal"
                          >
                            <option value="">Escolha um coletor</option>
                            {collectors.map((collector) => (
                              <option key={collector.id} value={collector.id} disabled={!collector.disponivel}>
                                {collector.nome}{collector.disponivel ? '' : ' (indisponível)'}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          onClick={() => void assign(request)}
                          disabled={!choice[request.id] || assigning !== null}
                          loading={assigning === request.id}
                          loadingText="Atribuindo…"
                        >
                          Atribuir
                        </Button>
                      </div>
                    </div>
                    {assignError[request.id] ? (
                      <p role="alert" className="mt-2 text-sm font-medium text-danger-700">{assignError[request.id]}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!loading && !loadError && requests.length > 0 && available.length === 0 ? (
            <p className="mt-3 text-sm text-reward-800">Nenhum coletor está disponível agora. O coletor marca a disponibilidade na área dele.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
