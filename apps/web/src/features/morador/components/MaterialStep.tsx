import type { MaterialCategory, MaterialOption } from '../types';
import { Icon } from './Icon';

interface MaterialStepProps {
  materials: MaterialOption[];
  selectedMaterialId: MaterialCategory | null;
  onSelect: (materialId: MaterialCategory) => void;
}

export function MaterialStep({ materials, selectedMaterialId, onSelect }: MaterialStepProps) {
  return (
    <section className="space-y-4" aria-labelledby="material-title">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase text-brand-700">
          <Icon name="leaf" className="h-4 w-4" />
          Etapa 1 de 3
        </p>
        <h1 id="material-title" className="mt-1 text-2xl font-bold text-neutral-950">
          Escolha o material
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Separe o tipo principal da coleta para mostrarmos pontos compatíveis e a pontuação estimada.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {materials.map((material) => {
          const isSelected = material.id === selectedMaterialId;

          return (
            <button
              key={material.id}
              type="button"
              onClick={() => onSelect(material.id)}
              className={[
                'min-h-[9rem] rounded-lg p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                isSelected ? 'eco-card-selected' : 'eco-card hover:border-brand-300',
              ].join(' ')}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-lg font-bold text-neutral-950">{material.name}</span>
                  <span className="mt-2 block text-sm leading-5 text-neutral-600">
                    {material.helper}
                  </span>
                </span>
                <span
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    isSelected ? 'bg-brand-600 text-white' : 'eco-icon-tile',
                  ].join(' ')}
                >
                  <Icon name="cycle" className="h-5 w-5" />
                </span>
              </span>
              <span className="mt-4 flex flex-wrap gap-2">
                {material.acceptedExamples.slice(0, 2).map((example) => (
                  <span
                    className="rounded-full border border-neutral-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
                    key={example}
                  >
                    {example}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
