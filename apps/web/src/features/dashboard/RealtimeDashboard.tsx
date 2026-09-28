/**
 * Painel operacional que liga o hook Socket.IO ao mapa MapLibre.
 * A tela mostra conexão, versão do estado e contagens suficientes para diagnosticar a integração do MVP.
 * Segue o guia de estilos: tokens do Tailwind, tons `operational` para separar o dashboard da experiência do morador.
 */
import { useEffect, useState } from 'react';
import { MapContainer } from '../../map/MapContainer';
import { formatAge } from '../../map/mapUtils';
import { useTempoReal, type RealtimeConnectionStatus } from '../../realtime/useTempoReal';
import { KpiCards } from './KpiCards';
import { RecentRequestsTable } from './RecentRequestsTable';
import { RegionDemand } from './RegionDemand';
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
  // Atualiza o "Atualizado há X" mesmo sem eventos novos.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  // Em telas largas ocupa a janela inteira com a tabela ao lado do mapa; em telas estreitas empilha e rola.
  return (
    <main className="flex min-h-screen w-full flex-col bg-neutral-50 text-neutral-900 lg:h-screen">
      <header className="z-[1] border-b border-neutral-200 border-t-4 border-t-operational-600 bg-neutral-0 px-screen py-3 lg:px-6">
        <div className="mx-auto flex max-w-dashboard flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-operational-700">Operação EcoRota</p>
            <h1 className="text-2xl font-bold text-neutral-900">Dashboard operacional</h1>
            <p className="mt-1 text-sm text-neutral-600">
              {points.length} pontos · {collectors.length} coletores · {realtime.snapshot?.requests.length ?? 0} solicitações
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {realtime.snapshot && (
              // Geração e revisão ficam no título, para diagnóstico, sem expor jargão ao operador.
              <span
                className="text-sm text-neutral-500"
                title={`Geração ${realtime.snapshot.generation} · revisão ${realtime.snapshot.revision}`}
              >
                Atualizado {formatAge(realtime.snapshot.updatedAt, now)}
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
          <div
            role="alert"
            className="mx-auto mt-3 flex max-w-dashboard flex-wrap items-center justify-between gap-3 rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800"
          >
            <span>{realtime.errorMessage}</span>
            {realtime.connectionStatus !== 'conectado' && (
              <button
                type="button"
                onClick={realtime.reconnect}
                className="inline-flex min-h-touch items-center rounded-md border border-danger-500 bg-neutral-0 px-3 font-semibold text-danger-700 hover:bg-danger-50"
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}
      </header>
      <KpiCards indicators={indicators} />
      <div className="mx-auto flex min-h-0 w-full max-w-dashboard flex-1 flex-col lg:flex-row lg:border-x lg:border-neutral-200">
        <section className="min-h-[420px] flex-1" aria-label="Visualização da operação">
          <MapContainer points={points} collectors={collectors} routes={routes} focus={focus} minHeight="420px" showLegend />
        </section>
        <aside className="flex h-[560px] flex-col border-t border-neutral-200 bg-neutral-0 lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
          <RegionDemand regions={indicators.data?.demandaPorRegiao} />
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
