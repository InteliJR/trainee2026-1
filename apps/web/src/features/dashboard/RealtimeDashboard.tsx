/**
 * Painel operacional que liga o hook Socket.IO ao mapa MapLibre.
 * A tela mostra conexão, versão do estado e contagens suficientes para diagnosticar a integração do MVP.
 * Segue o guia de estilos: tokens do Tailwind, tons `operational` para separar o dashboard da experiência do morador.
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

// Classes completas por estado (o Tailwind só gera classes escritas por inteiro no código).
const CONNECTION_CLASSES: Record<RealtimeConnectionStatus, string> = {
  conectando: 'bg-reward-100 text-reward-800',
  conectado: 'bg-brand-600 text-neutral-0',
  reconectando: 'bg-reward-100 text-reward-800',
  desconectado: 'bg-neutral-200 text-neutral-700',
  erro: 'bg-danger-600 text-neutral-0',
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
    <main className="flex min-h-screen w-full flex-col bg-neutral-50 text-neutral-900 lg:h-screen">
      <header className="z-[1] border-b border-neutral-200 border-t-4 border-t-operational-600 bg-neutral-0 px-screen py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-operational-700">Operação EcoRota</p>
            <h1 className="text-2xl font-bold text-neutral-900">Dashboard operacional</h1>
            <p className="mt-1 text-sm text-neutral-600">
              {points.length} pontos · {collectors.length} coletores · {realtime.snapshot?.requests.length ?? 0} solicitações
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {realtime.snapshot && (
              <span className="text-sm text-neutral-500">
                Geração {realtime.snapshot.generation} · revisão {realtime.snapshot.revision}
              </span>
            )}
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${CONNECTION_CLASSES[realtime.connectionStatus]}`}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
              {CONNECTION_LABELS[realtime.connectionStatus]}
            </span>
          </div>
        </div>
        {realtime.errorMessage && (
          <p role="alert" className="mt-3 rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {realtime.errorMessage}
          </p>
        )}
      </header>
      <KpiCards indicators={indicators} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-[420px] flex-1" aria-label="Visualização da operação">
          <MapContainer points={points} collectors={collectors} routes={routes} focus={focus} minHeight="420px" showLegend />
        </section>
        <aside className="h-[420px] border-t border-neutral-200 lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
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
