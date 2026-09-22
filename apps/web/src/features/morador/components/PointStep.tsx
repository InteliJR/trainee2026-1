import type { CollectionPoint, MaterialCategory } from '../types';

interface PointStepProps {
  points: CollectionPoint[];
  selectedMaterialId: MaterialCategory;
  selectedPointId: string | null;
  selectedNeighborhood: string;
  neighborhoods: readonly string[];
  onNeighborhoodChange: (neighborhood: string) => void;
  onSelect: (pointId: string) => void;
}

export function PointStep({
  points,
  selectedMaterialId,
  selectedPointId,
  selectedNeighborhood,
  neighborhoods,
  onNeighborhoodChange,
  onSelect,
}: PointStepProps) {
  const compatiblePoints = points.filter((point) => point.accepts.includes(selectedMaterialId));
  const visiblePoints = compatiblePoints.filter(
    (point) => selectedNeighborhood === 'Todos' || point.neighborhood === selectedNeighborhood,
  );

  return (
    <section className="space-y-4" aria-labelledby="point-title">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-700">Etapa 2 de 3</p>
        <h1 id="point-title" className="mt-1 text-2xl font-bold text-neutral-950">
          Selecione o ponto
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Filtre por bairro e escolha o ponto de coleta com melhor encaixe para o seu descarte.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtro por bairro">
        {neighborhoods.map((neighborhood) => {
          const isSelected = neighborhood === selectedNeighborhood;

          return (
            <button
              key={neighborhood}
              type="button"
              onClick={() => onNeighborhoodChange(neighborhood)}
              className={[
                'min-h-touch shrink-0 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                isSelected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
              ].join(' ')}
            >
              {neighborhood}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3">
        {visiblePoints.map((point) => {
          const isSelected = point.id === selectedPointId;
          const activeDemand = point.demand.pending + point.demand.assigned + point.demand.in_service;

          return (
            <button
              key={point.id}
              type="button"
              onClick={() => onSelect(point.id)}
              className={[
                'rounded-lg border bg-white p-4 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                isSelected
                  ? 'border-brand-600 ring-2 ring-brand-100'
                  : 'border-neutral-200 hover:border-brand-300',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-neutral-950">{point.name}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{point.address}</p>
                </div>
                <span className="rounded-full bg-operational-100 px-3 py-1 text-sm font-semibold text-operational-800">
                  {point.distanceKm.toFixed(1)} km
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-neutral-100 p-3">
                  <dt className="text-neutral-500">Bairro</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">{point.neighborhood}</dd>
                </div>
                <div className="rounded-md bg-neutral-100 p-3">
                  <dt className="text-neutral-500">Demandas</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">{activeDemand}</dd>
                </div>
                <div className="rounded-md bg-neutral-100 p-3">
                  <dt className="text-neutral-500">Proximo</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">{point.nextAvailability}</dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>

      {visiblePoints.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          Nenhum ponto encontrado para este filtro. Tente outro bairro para continuar.
        </p>
      ) : null}
    </section>
  );
}
