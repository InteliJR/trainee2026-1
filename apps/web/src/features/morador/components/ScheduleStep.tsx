import type { CollectionPoint, MaterialOption, ResidentRequestDraft, ShiftOption } from '../types';
import { Icon } from './Icon';

interface ScheduleStepProps {
  draft: ResidentRequestDraft;
  material: MaterialOption;
  point: CollectionPoint;
  shifts: ShiftOption[];
  onDateChange: (date: string) => void;
  onShiftChange: (shiftId: ShiftOption['id']) => void;
  // Regra de pontos da API; null enquanto não carregou.
  pointsPerCollection: number | null;
}

export function ScheduleStep({
  draft,
  material,
  point,
  shifts,
  onDateChange,
  onShiftChange,
  pointsPerCollection,
}: ScheduleStepProps) {
  return (
    <section className="space-y-4" aria-labelledby="schedule-title">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase text-brand-700">
          <Icon name="calendar" className="h-4 w-4" />
          Etapa 3 de 3
        </p>
        <h1 id="schedule-title" className="mt-1 text-2xl font-bold text-neutral-950">
          Data e turno
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Defina quando o coletor deve retirar o material. A confirmação final aparece no resumo.
        </p>
      </div>

      <div className="grid gap-5">
        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          <span className="flex items-center gap-2">
            <Icon name="calendar" className="h-5 w-5 text-operational-700" />
            Data desejada
          </span>
          <input
            type="date"
            value={draft.desiredDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="min-h-touch rounded-md border border-neutral-200 bg-white/90 px-3 text-base font-medium text-neutral-950 shadow-card focus:border-operational-500 focus:outline-none focus:ring-2 focus:ring-operational-100"
          />
        </label>

        <div className="grid gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <Icon name="clock" className="h-5 w-5 text-operational-700" />
            Turno
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            {shifts.map((shift) => {
              const isSelected = shift.id === draft.shift;

              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => onShiftChange(shift.id)}
                  className={[
                    'min-h-[6rem] rounded-lg p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                    isSelected
                      ? 'eco-card-selected'
                      : 'eco-card hover:border-brand-300',
                  ].join(' ')}
                >
                  <span className="block text-base font-bold text-neutral-950">{shift.label}</span>
                  <span className="mt-1 block text-sm text-neutral-600">{shift.window}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="eco-panel rounded-lg p-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-neutral-950">
          <Icon name="cycle" className="h-5 w-5 text-brand-700" />
          Resumo da solicitação
        </h2>
        <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
          <div className="flex justify-between gap-3">
            <dt>Material</dt>
            <dd className="text-right font-semibold text-neutral-950">{material.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Quantidade</dt>
            <dd className="text-right font-semibold text-neutral-950">
              {draft.quantityKg.trim() ? `${draft.quantityKg.trim()} kg` : 'Não informada'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Ponto</dt>
            <dd className="text-right font-semibold text-neutral-950">{point.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Local do ponto</dt>
            <dd className="text-right font-semibold text-neutral-950">{point.address}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Pontos previstos</dt>
            <dd className="text-right font-semibold text-reward-800">{pointsPerCollection === null ? '—' : `+${pointsPerCollection}`}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
