import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, buttonClasses } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { InlineNotice } from '../../components/InlineNotice';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView';
import { ApiError } from '../../lib/api';
import { CollectionPointForm } from './CollectionPointForm';
import { formFromPoint } from './collectionPointValidation';
import {
  archiveCollectionPoint,
  createCollectionPoint,
  listCollectionPoints,
  listEcoRotaCollectionPoints,
  updateCollectionPoint,
  type CollectionPointInput,
  type EcoRotaCollectionPoint,
  type LocalCollectionPoint,
} from './collectionPointsApi';
import { logoutOperator } from './operatorAuth';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (error.status === 0) return 'Sem conexão com a API. Verifique o servidor e tente novamente.';
    return error.message;
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}

export function CollectionPointsPage() {
  const navigate = useNavigate();
  const [points, setPoints] = useState<LocalCollectionPoint[]>([]);
  const [ecoRotaPoints, setEcoRotaPoints] = useState<EcoRotaCollectionPoint[]>([]);
  const [source, setSource] = useState<'ECOROTA' | 'LOCAIS'>('ECOROTA');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formPoint, setFormPoint] = useState<LocalCollectionPoint | 'new' | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<LocalCollectionPoint | null>(null);
  const [filter, setFilter] = useState<'TODOS' | 'ATIVOS' | 'INATIVOS'>('TODOS');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [localResponse, ecoRotaResponse] = await Promise.all([
        listCollectionPoints(),
        listEcoRotaCollectionPoints(),
      ]);
      setPoints(localResponse.dados);
      setEcoRotaPoints(ecoRotaResponse.dados);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => points.filter((point) => {
    if (filter === 'ATIVOS') return point.ativo;
    if (filter === 'INATIVOS') return !point.ativo;
    return true;
  }), [filter, points]);

  async function save(input: CollectionPointInput) {
    setSaving(true);
    setFormError('');
    try {
      if (formPoint === 'new') {
        await createCollectionPoint(input);
        setFeedback('Ponto cadastrado com sucesso.');
      } else if (formPoint) {
        await updateCollectionPoint(formPoint.id, input);
        setFeedback('Ponto atualizado com sucesso.');
      }
      setFormPoint(null);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/operador/login', { replace: true, state: { from: '/dashboard/pontos' } });
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(point: LocalCollectionPoint) {
    setFeedback('');
    try {
      await updateCollectionPoint(point.id, { ativo: !point.ativo });
      setFeedback(point.ativo ? 'Ponto desativado.' : 'Ponto reativado.');
      await load();
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }

  async function archive() {
    if (!archiving) return;
    setSaving(true);
    try {
      await archiveCollectionPoint(archiving.id);
      setArchiving(null);
      setFeedback('Ponto arquivado com sucesso.');
      await load();
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setSaving(false);
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
            <h1 className="text-2xl font-bold">Gestão de pontos</h1>
            <p className="mt-1 text-sm text-neutral-600">Cadastre e mantenha os pontos locais da operação.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className={buttonClasses('secondary')}>Visão operacional</Link>
            <Button variant="secondary" icon={<Icon name="logout" className="h-4 w-4" />} onClick={() => void logout()}>Sair</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-dashboard space-y-6 px-screen py-6 lg:px-6">
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos pontos">
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi"><p className="text-sm text-neutral-600">Pontos EcoRota</p><p className="mt-1 text-2xl font-bold tabular-nums text-operational-700">{ecoRotaPoints.length}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi"><p className="text-sm text-neutral-600">Locais ativos</p><p className="mt-1 text-2xl font-bold tabular-nums text-brand-700">{points.filter((point) => point.ativo).length}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi"><p className="text-sm text-neutral-600">Locais inativos</p><p className="mt-1 text-2xl font-bold tabular-nums text-neutral-700">{points.filter((point) => !point.ativo).length}</p></div>
        </section>

        <InlineNotice tone="info">Os pontos EcoRota são sincronizados da operação e podem receber solicitações. Pontos locais são administrados por esta plataforma e ainda não participam da simulação externa.</InlineNotice>
        {feedback ? <InlineNotice tone="success">{feedback}</InlineNotice> : null}

        <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-card sm:p-5">
          <div className="mb-5 flex flex-wrap gap-2 border-b border-neutral-200 pb-4" role="tablist" aria-label="Origem dos pontos">
            <button type="button" role="tab" aria-selected={source === 'ECOROTA'} onClick={() => setSource('ECOROTA')} className={`min-h-touch rounded-md px-4 text-sm font-semibold ${source === 'ECOROTA' ? 'bg-operational-700 text-neutral-0' : 'border border-neutral-300 bg-neutral-0 text-neutral-700 hover:bg-neutral-100'}`}>EcoRota ({ecoRotaPoints.length})</button>
            <button type="button" role="tab" aria-selected={source === 'LOCAIS'} onClick={() => setSource('LOCAIS')} className={`min-h-touch rounded-md px-4 text-sm font-semibold ${source === 'LOCAIS' ? 'bg-operational-700 text-neutral-0' : 'border border-neutral-300 bg-neutral-0 text-neutral-700 hover:bg-neutral-100'}`}>Locais ({points.length})</button>
          </div>

          {source === 'ECOROTA' ? (
            <div>
              <div><h2 className="text-lg font-semibold">Pontos EcoRota</h2><p className="text-sm text-neutral-600">Sincronizados do estado operacional e disponíveis no mapa.</p></div>
              <div className="mt-5">
                {loading ? <LoadingState label="Carregando pontos EcoRota…" /> : loadError ? <ErrorState message={loadError} onRetry={() => void load()} /> : ecoRotaPoints.length === 0 ? <EmptyState title="Nenhum ponto EcoRota disponível" description="Aguarde a sincronização da operação e tente novamente." /> : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {ecoRotaPoints.map((point) => {
                      const activeDemand = point.demanda.pendentes + point.demanda.atribuidas + point.demanda.emAtendimento;
                      return (
                        <article key={point.id} className="rounded-lg border border-operational-100 bg-neutral-0 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><h3 className="font-semibold text-neutral-900">{point.nome}</h3><p className="mt-1 text-sm text-neutral-600">Circuito {point.circuito} · {point.tipo === 'ADICIONAL' ? 'Adicional' : 'Habitual'}</p></div>
                            <span className="rounded-full bg-operational-50 px-3 py-1 text-sm font-semibold text-operational-800">EcoRota</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-md bg-neutral-50 p-3"><span className="block text-neutral-600">Demanda ativa</span><strong className="text-lg tabular-nums">{activeDemand}</strong></div>
                            <div className="rounded-md bg-neutral-50 p-3"><span className="block text-neutral-600">Concluídas</span><strong className="text-lg tabular-nums">{point.demanda.concluidas}</strong></div>
                          </div>
                          <p className="mt-3 text-sm tabular-nums text-neutral-600">{point.coordenadas.latitude}, {point.coordenadas.longitude}</p>
                          {point.dadosDesatualizados ? <p className="mt-2 text-sm font-medium text-reward-800">Telemetria desatualizada</p> : null}
                          <div className="mt-4"><Link to="/dashboard" className={buttonClasses('ghost')}>Ver no mapa</Link></div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-lg font-semibold">Pontos locais</h2><p className="text-sm text-neutral-600">{visible.length} resultado(s)</p></div>
            <Button onClick={() => { setFormError(''); setFormPoint('new'); }}>Cadastrar ponto</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar pontos por situação">
            {(['TODOS', 'ATIVOS', 'INATIVOS'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-touch rounded-full border px-4 text-sm font-semibold ${filter === value ? 'border-operational-700 bg-operational-700 text-neutral-0' : 'border-neutral-300 bg-neutral-0 text-neutral-700 hover:bg-neutral-100'}`}>{value === 'TODOS' ? 'Todos' : value === 'ATIVOS' ? 'Ativos' : 'Inativos'}</button>
            ))}
          </div>

          <div className="mt-5">
            {loading ? <LoadingState label="Carregando pontos…" /> : loadError ? <ErrorState message={loadError} onRetry={() => void load()} /> : visible.length === 0 ? (
              <EmptyState title="Nenhum ponto encontrado" description="Cadastre um ponto ou altere o filtro para continuar." action={<Button onClick={() => setFormPoint('new')}>Cadastrar ponto</Button>} />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visible.map((point) => (
                  <article key={point.id} className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><h3 className="font-semibold text-neutral-900">{point.nome}</h3><p className="mt-1 text-sm text-neutral-600">Circuito {point.circuito} · {point.tipo === 'ADICIONAL' ? 'Adicional' : 'Habitual'}</p></div>
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${point.ativo ? 'bg-brand-100 text-brand-800' : 'bg-neutral-200 text-neutral-700'}`}>{point.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <p className="mt-3 text-sm text-neutral-700">{point.descricao || 'Sem descrição.'}</p>
                    <p className="mt-2 text-sm tabular-nums text-neutral-600">{point.coordenadas.latitude}, {point.coordenadas.longitude}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => { setFormError(''); setFormPoint(point); }}>Editar</Button>
                      <Button variant="ghost" onClick={() => void toggle(point)}>{point.ativo ? 'Desativar' : 'Reativar'}</Button>
                      <Button variant="danger" onClick={() => setArchiving(point)}>Arquivar</Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          </>}
        </section>
      </div>

      <CollectionPointForm
        key={formPoint === 'new' ? 'new' : formPoint?.id ?? 'closed'}
        open={formPoint !== null}
        title={formPoint === 'new' ? 'Cadastrar ponto' : 'Editar ponto'}
        initialValues={formPoint && formPoint !== 'new' ? formFromPoint(formPoint) : undefined}
        loading={saving}
        apiError={formError}
        onClose={() => !saving && setFormPoint(null)}
        onSubmit={save}
      />
      <ConfirmDialog open={Boolean(archiving)} title="Arquivar ponto?" cancelLabel="Manter ponto" confirmLabel="Arquivar ponto" confirmVariant="danger-solid" loading={saving} onCancel={() => setArchiving(null)} onConfirm={() => void archive()}>
        O ponto “{archiving?.nome}” deixará de aparecer na listagem. Para uma pausa temporária, prefira desativá-lo.
      </ConfirmDialog>
    </main>
  );
}
