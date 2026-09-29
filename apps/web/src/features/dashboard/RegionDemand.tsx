/**
 * Painel "Demanda por região" do dashboard (microcopy do guia de estilos).
 * Compara, por circuito, as solicitações ativas com os coletores disponíveis; o estado vem escrito,
 * além da cor, para não depender só dela.
 */
import type { OperationIndicators } from './useIndicadores';

type Region = OperationIndicators['demandaPorRegiao'][number];

// Traduz o saldo de capacidade em um estado curto com as cores semânticas do guia.
export function capacityState(balance: number): { label: string; className: string } {
  if (balance < 0) return { label: 'Falta capacidade', className: 'bg-danger-50 text-danger-700' };
  if (balance === 0) return { label: 'No limite', className: 'bg-reward-100 text-reward-800' };
  return { label: 'Com folga', className: 'bg-status-completed-bg text-status-completed' };
}

// Lista os circuitos com demanda e capacidade; mostra travessão enquanto os indicadores não chegam.
export function RegionDemand({ regions }: { regions: Region[] | undefined }) {
  return (
    <section aria-labelledby="region-demand-title" className="border-b border-neutral-200 px-4 py-3">
      <h2 id="region-demand-title" className="text-lg font-bold text-neutral-900">
        Demanda por região
      </h2>
      {!regions ? (
        <p className="mt-1 text-sm text-neutral-600">Carregando demanda…</p>
      ) : regions.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-600">Nenhum circuito com pontos ou coletores no momento.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {regions.map((region) => {
            const state = capacityState(region.saldoCapacidade);
            return (
              <li key={region.circuito} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <strong className="block text-sm text-neutral-900">{region.regiao}</strong>
                  <span className="block text-sm text-neutral-600">
                    {region.solicitacoesAtivas} ativas · {region.capacidadeOfertada} coletores disponíveis
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold ${state.className}`}>
                  {state.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
