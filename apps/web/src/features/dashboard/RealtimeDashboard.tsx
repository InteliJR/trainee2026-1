/**
 * Painel operacional que liga o hook Socket.IO ao mapa MapLibre.
 * A tela mostra conexão, versão do estado e contagens suficientes para diagnosticar a integração do MVP.
 */
import { useState } from 'react';
import { MapContainer } from '../../map/MapContainer';
import { useTempoReal, type RealtimeConnectionStatus } from '../../realtime/useTempoReal';
import { KpiCards } from './KpiCards';
import { RecentRequestsTable } from './RecentRequestsTable';
import { useIndicadores } from './useIndicadores';

// Traduz os estados internos para rótulos curtos apresentados ao usuário.
const CONNECTION_LABELS: Record<RealtimeConnectionStatus, string> = {
  conectando: 'Conectando',
  conectado: 'Tempo real conectado',
  reconectando: 'Reconectando',
  desconectado: 'Desconectado',
  erro: 'Falha na conexão',
};

// Associa cada estado a uma cor sem depender de classes geradas dinamicamente pelo Tailwind.
const CONNECTION_COLORS: Record<RealtimeConnectionStatus, string> = {
  conectando: '#D97706',
  conectado: '#047857',
  reconectando: '#D97706',
  desconectado: '#6B7280',
  erro: '#B91C1C',
};

// Renderiza a visão operacional e fornece ao mapa apenas as coleções autorizadas pelo servidor.
export function RealtimeDashboard() {
  // Abre a conexão usando exclusivamente o cookie httpOnly criado pelo endpoint de login.
  const realtime = useTempoReal({});
  // Usa arrays vazios antes do snapshot para impedir a reaparição de dados simulados.
  const points = realtime.snapshot?.points ?? [];
  // Usa arrays vazios antes do snapshot para manter o mapa coerente com a conexão real.
  const collectors = realtime.snapshot?.collectors ?? [];
  // Usa arrays vazios antes do snapshot para não desenhar rotas de uma conexão anterior.
  const routes = realtime.snapshot?.routes ?? [];
  // Consulta os KPIs só com a sessão confirmada e reconsulta a cada mudança de solicitação recebida.
  const indicators = useIndicadores({
    enabled: realtime.connectionStatus === 'conectado',
    refreshKey: realtime.lastRequestEvent,
  });
  // Ponto escolhido na tabela; o nonce faz o mapa voltar ao ponto mesmo se a mesma linha for clicada de novo.
  const [focus, setFocus] = useState<{ pointId: string; nonce: number } | null>(null);

  // Em telas largas ocupa a janela inteira com a tabela ao lado do mapa; em telas estreitas empilha e rola.
  return (
    <main className="min-h-screen lg:h-screen" style={{ width: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '14px 18px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: '#111827', fontSize: '22px' }}>Dashboard Operacional EcoRota</h1>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '13px' }}>
              {points.length} pontos · {collectors.length} coletores · {realtime.snapshot?.requests.length ?? 0} solicitações
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {realtime.snapshot && (
              <span style={{ color: '#4B5563', fontSize: '12px' }}>
                Geração {realtime.snapshot.generation} · revisão {realtime.snapshot.revision}
              </span>
            )}
            <span
              role="status"
              aria-live="polite"
              style={{
                color: '#FFFFFF',
                background: CONNECTION_COLORS[realtime.connectionStatus],
                borderRadius: '999px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {CONNECTION_LABELS[realtime.connectionStatus]}
            </span>
          </div>
        </div>
        {realtime.errorMessage && (
          <p role="alert" style={{ margin: '10px 0 0', color: '#991B1B', background: '#FEE2E2', padding: '8px 10px', borderRadius: '6px', fontSize: '13px' }}>
            {realtime.errorMessage}
          </p>
        )}
      </header>
      <KpiCards indicators={indicators} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-[420px] flex-1" aria-label="Visualização da operação">
          <MapContainer points={points} collectors={collectors} routes={routes} focus={focus} minHeight="420px" />
        </section>
        <aside className="h-[420px] border-t border-neutral-200 lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0">
          <RecentRequestsTable
            snapshot={realtime.snapshot}
            lastRequestEvent={realtime.lastRequestEvent}
            onSelectPoint={(pointId) => setFocus((current) => ({ pointId, nonce: (current?.nonce ?? 0) + 1 }))}
          />
        </aside>
      </div>
    </main>
  );
}
