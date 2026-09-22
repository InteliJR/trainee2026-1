import type { CollectionPoint, MaterialOption, ResidentRequestDraft, ShiftOption } from '../types';

interface ScheduleStepProps {
  draft: ResidentRequestDraft;
  material: MaterialOption;
  point: CollectionPoint;
  shifts: ShiftOption[];
  onDateChange: (date: string) => void;
  onShiftChange: (shiftId: ShiftOption['id']) => void;
  onNotesChange: (notes: string) => void;
}

export function ScheduleStep({
  draft,
  material,
  point,
  shifts,
  onDateChange,
  onShiftChange,
  onNotesChange,
}: ScheduleStepProps) {
  return (
    <section className="space-y-4" aria-labelledby="schedule-title">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-700">Etapa 3 de 3</p>
        <h1 id="schedule-title" className="mt-1 text-2xl font-bold text-neutral-950">
          Data e turno
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Defina quando o coletor deve retirar o material. A confirmacao final aparece no resumo.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-card">
        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Data desejada
          <input
            type="date"
            value={draft.desiredDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="min-h-touch rounded-md border border-neutral-300 px-3 text-base font-medium text-neutral-950 focus:border-operational-500 focus:outline-none focus:ring-2 focus:ring-operational-100"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-neutral-800">Turno</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {shifts.map((shift) => {
              const isSelected = shift.id === draft.shift;

              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => onShiftChange(shift.id)}
                  className={[
                    'min-h-[6rem] rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500',
                    isSelected
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100'
                      : 'border-neutral-200 bg-white hover:border-brand-300',
                  ].join(' ')}
                >
                  <span className="block text-base font-bold text-neutral-950">{shift.label}</span>
                  <span className="mt-1 block text-sm text-neutral-600">{shift.window}</span>
                  <span className="mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-700">
                    {shift.slots} vagas
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Observacao para o coletor
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Ex.: material separado na portaria, garrafas em sacola azul."
            className="rounded-md border border-neutral-300 px-3 py-3 text-base font-medium text-neutral-950 placeholder:text-neutral-400 focus:border-operational-500 focus:outline-none focus:ring-2 focus:ring-operational-100"
          />
        </label>
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h2 className="text-base font-bold text-neutral-950">Resumo da solicitacao</h2>
        <dl className="mt-3 grid gap-2 text-sm text-neutral-700">
          <div className="flex justify-between gap-3">
            <dt>Material</dt>
            <dd className="text-right font-semibold text-neutral-950">{material.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Ponto</dt>
            <dd className="text-right font-semibold text-neutral-950">{point.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Endereco</dt>
            <dd className="text-right font-semibold text-neutral-950">{point.address}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Pontos previstos</dt>
            <dd className="text-right font-semibold text-reward-800">+{material.points}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
