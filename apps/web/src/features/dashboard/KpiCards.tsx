/**
 * Faixa de cards com os KPIs principais do painel operacional.
 * Recebe o estado do hook useIndicadores e mostra placeholders enquanto os dados não chegam.
 */
import type { IndicatorsState } from './useIndicadores';

// Descreve um card: valor principal em destaque e uma linha de contexto logo abaixo.
interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
  // Destaca em vermelho indicadores que pedem atenção do operador.
  alert?: boolean;
}

// Desenha um único card com estilos inline, no mesmo padrão do cabeçalho do painel.
function KpiCard({ label, value, detail, alert = false }: KpiCardProps) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        minWidth: 0,
        background: '#FFFFFF',
        border: `1px solid ${alert ? '#FCA5A5' : '#E5E7EB'}`,
        borderRadius: '10px',
        padding: '10px 14px',
      }}
    >
      <p style={{ margin: 0, color: '#6B7280', fontSize: '12px', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '2px 0', color: alert ? '#B91C1C' : '#111827', fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ margin: 0, color: '#6B7280', fontSize: '12px' }}>{detail}</p>
    </div>
  );
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
    <section aria-label="Indicadores operacionais" style={{ padding: '10px 18px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <KpiCard
          label="Coletas hoje"
          value={format(data?.coletasRealizadas.hoje)}
          detail={data ? `${data.coletasRealizadas.semanaAtual} na semana · ${data.coletasRealizadas.mesAtual} no mês` : '—'}
        />
        <KpiCard
          label="Solicitações ativas"
          value={format(activeRequests)}
          detail={requests ? `${requests.pendentes} pendentes · ${requests.atribuidas} atribuídas · ${requests.emAtendimento} em atendimento` : '—'}
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
          label="Taxa de conclusão (mês)"
          value={data ? `${data.tracao.taxaConclusaoPercentual.toLocaleString('pt-BR')}%` : '—'}
          detail={data ? `${data.tracao.concluidasNoMes} concluídas · ${data.tracao.canceladasNoMes} canceladas` : '—'}
        />
      </div>
      {indicators.errorMessage && (
        <p role="status" style={{ margin: '8px 0 0', color: '#92400E', fontSize: '12px' }}>
          {indicators.errorMessage}
        </p>
      )}
    </section>
  );
}

// Mostra travessão enquanto o valor ainda não foi carregado.
function format(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('pt-BR');
}
