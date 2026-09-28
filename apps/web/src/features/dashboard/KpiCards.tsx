/**
 * Faixa de cards com os KPIs principais do painel operacional.
 * Recebe o estado do hook useIndicadores e mostra placeholders enquanto os dados não chegam.
 * Nomes e visual seguem o guia de estilos: título curto, valor grande, contexto e estado quando aplicável.
 */
import type { IndicatorsState, OperationIndicators } from './useIndicadores';

// Descreve um card: valor principal em destaque e uma linha de contexto logo abaixo.
interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
  // Destaca indicadores que pedem atenção do operador.
  alert?: boolean;
}

// Desenha um único card com os tokens do guia (shadow-kpi, neutral e danger para alerta).
function KpiCard({ label, value, detail, alert = false }: KpiCardProps) {
  return (
    <div
      className={`min-w-0 flex-[1_1_10rem] rounded-lg border bg-neutral-0 px-4 py-3 shadow-kpi ${
        alert ? 'border-danger-500' : 'border-neutral-200'
      }`}
    >
      <p className="text-sm font-semibold text-neutral-600">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${alert ? 'text-danger-700' : 'text-neutral-900'}`}>{value}</p>
      <p className="text-sm text-neutral-500">
        {alert ? <span className="font-semibold text-danger-700">Atenção · </span> : null}
        {detail}
      </p>
    </div>
  );
}

// Calcula a taxa de cancelamento do mês entre as solicitações já encerradas.
export function cancellationRate(data: OperationIndicators): number {
  const { concluidasNoMes, canceladasNoMes } = data.tracao;
  const finished = concluidasNoMes + canceladasNoMes;
  return finished === 0 ? 0 : (canceladasNoMes / finished) * 100;
}

// Monta a faixa completa a partir dos indicadores; valores ausentes aparecem como travessão.
export function KpiCards({ indicators }: { indicators: IndicatorsState }) {
  const data = indicators.data;
  const requests = data?.solicitacoesAtuais;
  const collectors = data?.coletores;
  // Considera ativas as solicitações que ainda exigem ação de algum coletor.
  const activeRequests = requests ? requests.pendentes + requests.atribuidas + requests.emAtendimento : null;
  const staleTelemetry = collectors?.telemetriaDesatualizada ?? 0;

  return (
    <section aria-label="Indicadores operacionais" className="border-b border-neutral-200 bg-neutral-50 px-screen py-3 lg:px-6">
      <div className="mx-auto flex max-w-dashboard flex-wrap gap-3">
        <KpiCard
          label="Ativas agora"
          value={format(activeRequests)}
          detail={requests ? `${requests.pendentes} aguardando · ${requests.atribuidas} a caminho · ${requests.emAtendimento} no local` : '—'}
        />
        <KpiCard
          label="Concluídas hoje"
          value={format(data?.coletasRealizadas.hoje)}
          detail={data ? `${data.coletasRealizadas.semanaAtual} na semana · ${data.coletasRealizadas.mesAtual} no mês` : '—'}
        />
        <KpiCard
          label="Coletores disponíveis"
          value={collectors ? `${collectors.disponiveis}/${collectors.total}` : '—'}
          detail={collectors ? `${collectors.indisponiveisOuEmOperacao} indisponíveis ou em operação` : '—'}
        />
        <KpiCard
          label="Telemetria desatualizada"
          value={format(collectors?.telemetriaDesatualizada)}
          detail={staleTelemetry > 0 ? 'coletores sem posição recente' : 'todos com posição recente'}
          alert={staleTelemetry > 0}
        />
        <KpiCard
          label="Taxa de cancelamento"
          value={data ? `${cancellationRate(data).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}
          detail={data ? `${data.tracao.canceladasNoMes} canceladas · ${data.tracao.concluidasNoMes} concluídas no mês` : '—'}
        />
      </div>
      {indicators.errorMessage && (
        <div role="status" className="mx-auto mt-2 flex max-w-dashboard flex-wrap items-center gap-3 text-sm text-reward-800">
          <span>{indicators.errorMessage}</span>
          <button
            type="button"
            onClick={indicators.reload}
            className="inline-flex min-h-touch items-center rounded-md border border-neutral-300 bg-neutral-0 px-3 font-semibold text-neutral-800 hover:border-operational-600 hover:text-operational-700"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </section>
  );
}

// Mostra travessão enquanto o valor ainda não foi carregado.
function format(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('pt-BR');
}
