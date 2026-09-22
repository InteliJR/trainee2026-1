import type { MaterialCategory, MaterialOption } from '../types';

interface MaterialStepProps {
  materials: MaterialOption[];
  selectedMaterialId: MaterialCategory | null;
  onSelect: (materialId: MaterialCategory) => void;
}

export function MaterialStep({ materials, selectedMaterialId, onSelect }: MaterialStepProps) {
  return (
    <section className="space-y-4" aria-labelledby="material-title">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-700">Etapa 1 de 3</p>
        <h1 id="material-title" className="mt-1 text-2xl font-bold text-neutral-950">
          Escolha o material
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Separe o tipo principal da coleta para mostrarmos pontos compativeis e a pontuacao estimada.
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
                'min-h-[9rem] rounded-lg border bg-white p-4 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                isSelected
                  ? 'border-brand-600 ring-2 ring-brand-100'
                  : 'border-neutral-200 hover:border-brand-300 hover:bg-brand-50',
              ].join(' ')}
            >
              <span className="text-lg font-bold text-neutral-950">{material.name}</span>
              <span className="mt-2 block text-sm leading-5 text-neutral-600">{material.helper}</span>
              <span className="mt-3 inline-flex rounded-full bg-reward-100 px-3 py-1 text-sm font-semibold text-reward-800">
                +{material.points} pontos
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
