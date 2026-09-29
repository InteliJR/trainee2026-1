import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { translateStatus } from '@ecorota/shared';
import { EcoPageHeader } from '../components/EcoPageHeader';
import { Icon } from '../components/Icon';
import { ResidentBottomNav } from '../components/ResidentBottomNav';
import { getResidentRequests, refreshResidentRequests } from '../lib/residentRequests';

export function HistoricoImpactoPage() {
  const [requests, setRequests] = useState(getResidentRequests);

  // Atualiza com as solicitações reais do morador assim que a API responder.
  useEffect(() => {
    let active = true;
    void refreshResidentRequests().then((latest) => {
      if (active && latest) setRequests(latest);
    });
    return () => {
      active = false;
    };
  }, []);
  const completed = useMemo(() => requests.filter((request) => request.status === 'completed'), [requests]);
  const points = completed.reduce((sum, request) => sum + request.pointsPreview, 0);
  // Só entra no peso o que foi informado em kg na solicitação; nada é estimado por tipo de material.
  const withKg = completed.filter((request) => request.estimatedKg !== null);
  const kilograms = withKg.reduce((sum, request) => sum + (request.estimatedKg ?? 0), 0);
  const kgDetail = withKg.length === 0
    ? 'A quantidade ainda não é informada ao solicitar'
    : withKg.length === completed.length
      ? 'Quantidade informada nas coletas concluídas'
      : `Informado em ${withKg.length} de ${completed.length} coletas`;
  const weekKeys = new Set(completed.map((request) => weekKey(request.scheduledDate)));
  let streak = 0;
  const currentWeek = weekStart(new Date());
  for (let offset = 0; offset < 52; offset += 1) {
    const week = new Date(currentWeek);
    week.setUTCDate(week.getUTCDate() - offset * 7);
    if (!weekKeys.has(week.toISOString().slice(0, 10))) break;
    streak += 1;
  }
  const monthlyGoal = 5;
  const progress = Math.min(100, (completed.length / monthlyGoal) * 100);

  return (
    <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
      <div className="mx-auto max-w-dashboard space-y-6">
        <EcoPageHeader
          description="Cada coleta concluída vira impacto real. Pontos e quilos são contados somente depois da confirmação do coletor."
          eyebrow="Seu impacto"
          metric={`${completed.length}`}
          metricLabel="coletas concluídas"
          title="Histórico e conquistas"
        />

        <section aria-label="Resumo do impacto" className="grid gap-4 sm:grid-cols-3">
          <ImpactCard icon="award" label="Pontos disponíveis" value={`${points}`} detail="Somente coletas concluídas" />
          <ImpactCard icon="leaf" label="Material reciclado" value={withKg.length > 0 ? `${kilograms.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg` : '—'} detail={kgDetail} />
          <ImpactCard icon="cycle" label="Sequência" value={`${streak} semana${streak === 1 ? '' : 's'}`} detail="Semanas seguidas com coleta concluída" />
        </section>

        <section className="eco-panel rounded-lg p-5 sm:p-6" aria-labelledby="goal-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-reward-800">Meta do mês</p>
              <h2 id="goal-title" className="mt-1 text-xl font-bold">{completed.length} de {monthlyGoal} coletas concluídas</h2>
            </div>
            <span className="eco-icon-tile flex h-11 w-11 items-center justify-center rounded-lg"><Icon name="target" className="h-5 w-5" /></span>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-label="Progresso da meta mensal" aria-valuemin={0} aria-valuemax={monthlyGoal} aria-valuenow={Math.min(completed.length, monthlyGoal)}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-operational-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            {completed.length >= monthlyGoal ? 'Meta alcançada. Obrigado por fazer parte da mudança!' : `Faltam ${monthlyGoal - completed.length} coleta${monthlyGoal - completed.length === 1 ? '' : 's'} para bater sua meta.`}
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="history-title">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-sm font-semibold uppercase text-brand-700">Rastreabilidade</p><h2 id="history-title" className="mt-1 text-2xl font-bold">Suas coletas</h2></div>
            <Link to="/morador/solicitar" className="text-sm font-bold text-brand-700 underline underline-offset-4">Nova coleta</Link>
          </div>
          {requests.length ? <ul className="grid gap-3">{requests.map((request) => (
            <li className="eco-card rounded-lg p-4" key={request.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><span className="text-xs font-semibold uppercase text-earth-600">{request.protocol}</span><h3 className="mt-1 font-bold">{request.materialName}</h3><p className="mt-1 text-sm text-neutral-600">{request.pointName} · {request.scheduledDate}</p></div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{translateStatus(request.status)}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-3 text-sm">
                <Icon name="award" className="h-4 w-4 text-reward-800" />
                {request.status === 'completed' ? `+${request.pointsPreview} pontos creditados` : 'Pontos após a conclusão da coleta'}
              </div>
            </li>
          ))}</ul> : <div className="eco-card rounded-lg p-6 text-sm text-neutral-600">Nenhuma coleta registrada ainda. Solicite uma coleta para começar a acompanhar seu impacto.</div>}
        </section>
      </div>
      <ResidentBottomNav activeItem="historico" />
    </main>
  );
}

function weekKey(dateValue: string) {
  return weekStart(new Date(`${dateValue}T00:00:00.000Z`)).toISOString().slice(0, 10);
}

function weekStart(date: Date) {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  return monday;
}

function ImpactCard({ icon, label, value, detail }: { icon: 'award' | 'cycle' | 'leaf'; label: string; value: string; detail: string }) {
  return <article className="eco-card rounded-lg p-5"><span className="eco-icon-tile flex h-10 w-10 items-center justify-center rounded-lg"><Icon name={icon} className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-neutral-600">{label}</p><p className="mt-1 text-3xl font-bold text-neutral-950">{value}</p><p className="mt-2 text-xs text-neutral-500">{detail}</p></article>;
}
