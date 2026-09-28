import { useState } from 'react';
import type { CollectionPoint, MaterialCategory } from '../types';
import { Icon } from './Icon';
import { PointsMap } from './PointsMap';

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
  const [view, setView] = useState<'lista' | 'mapa'>('lista');

  return (
    <section className="space-y-4" aria-labelledby="point-title">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase text-brand-700">
          <Icon name="map-pin" className="h-4 w-4" />
          Etapa 2 de 3
        </p>
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
                  ? 'border-brand-600 bg-brand-600 text-white shadow-card'
                  : 'border-neutral-200 bg-white/80 text-neutral-700 hover:border-brand-300 hover:bg-brand-50',
              ].join(' ')}
            >
              {neighborhood}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Ver pontos em lista ou no mapa">
        <ViewToggleButton label="Lista" active={view === 'lista'} onClick={() => setView('lista')} />
        <ViewToggleButton label="Mapa" active={view === 'mapa'} onClick={() => setView('mapa')} />
      </div>

      {view === 'mapa' && visiblePoints.length > 0 ? (
        <PointsMap points={visiblePoints} selectedPointId={selectedPointId} onSelect={onSelect} />
      ) : null}

      {view === 'lista' ? (
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
                'rounded-lg p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                isSelected ? 'eco-card-selected' : 'eco-card hover:border-brand-300',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span
                    className={[
                      'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      isSelected ? 'bg-brand-600 text-white' : 'eco-icon-tile',
                    ].join(' ')}
                  >
                    <Icon name="map-pin" className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-950">{point.name}</h2>
                    <p className="mt-1 text-sm text-neutral-600">{point.address}</p>
                  </div>
                </div>
                <span className="rounded-full border border-operational-100 bg-operational-100 px-3 py-1 text-sm font-semibold text-operational-800">
                  {point.distanceKm.toFixed(1)} km
                </span>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-neutral-200 pt-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-neutral-500">Bairro</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">{point.neighborhood}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Demandas</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">{activeDemand}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Próximo</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">{point.nextAvailability}</dd>
                </div>
              </dl>
            </button>
          );
        })}
        </div>
      ) : null}

      {visiblePoints.length === 0 ? (
        <p className="eco-card rounded-lg p-4 text-sm text-neutral-600">
          Nenhum ponto encontrado para este filtro. Tente outro bairro para continuar.
        </p>
      ) : null}
    </section>
  );
}

interface ViewToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ViewToggleButton({ label, active, onClick }: ViewToggleButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'min-h-touch flex-1 rounded-md border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-card'
          : 'border-neutral-200 bg-white/80 text-neutral-700 hover:border-brand-300 hover:bg-brand-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
