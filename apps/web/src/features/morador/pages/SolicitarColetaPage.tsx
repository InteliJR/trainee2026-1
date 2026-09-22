import { useMemo, useState } from 'react';
import { MaterialStep } from '../components/MaterialStep';
import { PointStep } from '../components/PointStep';
import { ScheduleStep } from '../components/ScheduleStep';
import { StepIndicator } from '../components/StepIndicator';
import {
  collectionPoints,
  materialOptions,
  neighborhoodFilters,
  shiftOptions,
} from '../data/mockSolicitacao';
import type { MaterialCategory, ResidentRequestDraft, Shift } from '../types';

const initialDraft: ResidentRequestDraft = {
  materialId: null,
  pointId: null,
  desiredDate: '',
  shift: null,
  notes: '',
};

export function SolicitarColetaPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('Todos');
  const [draft, setDraft] = useState<ResidentRequestDraft>(initialDraft);
  const [submitted, setSubmitted] = useState(false);

  const selectedMaterial = useMemo(
    () => materialOptions.find((material) => material.id === draft.materialId) ?? null,
    [draft.materialId],
  );

  const selectedPoint = useMemo(
    () => collectionPoints.find((point) => point.id === draft.pointId) ?? null,
    [draft.pointId],
  );

  const canContinue =
    (currentStep === 1 && Boolean(draft.materialId)) ||
    (currentStep === 2 && Boolean(draft.pointId)) ||
    (currentStep === 3 && Boolean(draft.desiredDate && draft.shift));

  function selectMaterial(materialId: MaterialCategory) {
    setDraft((previous) => ({ ...previous, materialId, pointId: null }));
    setSelectedNeighborhood('Todos');
  }

  function selectPoint(pointId: string) {
    setDraft((previous) => ({ ...previous, pointId }));
  }

  function setDesiredDate(desiredDate: string) {
    setDraft((previous) => ({ ...previous, desiredDate }));
  }

  function setShift(shift: Shift) {
    setDraft((previous) => ({ ...previous, shift }));
  }

  function setNotes(notes: string) {
    setDraft((previous) => ({ ...previous, notes }));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(1, step - 1));
  }

  function goNext() {
    if (currentStep === 3) {
      setSubmitted(true);
      return;
    }

    setCurrentStep((step) => Math.min(3, step + 1));
  }

  function resetFlow() {
    setDraft(initialDraft);
    setCurrentStep(1);
    setSelectedNeighborhood('Todos');
    setSubmitted(false);
  }

  if (submitted && selectedMaterial && selectedPoint) {
    const selectedShift = shiftOptions.find((shift) => shift.id === draft.shift);

    return (
      <main className="min-h-screen bg-neutral-100 px-screen py-6 text-neutral-950">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-app flex-col justify-center">
          <section className="rounded-lg border border-brand-200 bg-white p-6 shadow-card">
            <p className="text-sm font-semibold uppercase text-brand-700">Solicitacao criada</p>
            <h1 className="mt-2 text-3xl font-bold">Coleta agendada</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Esta e uma simulacao com dados mockados. Quando a API estiver pronta, este fluxo vai
              enviar a solicitacao para o endpoint real.
            </p>

            <dl className="mt-6 grid gap-3 text-sm">
              <div className="rounded-md bg-neutral-100 p-3">
                <dt className="text-neutral-500">Material</dt>
                <dd className="mt-1 font-semibold">{selectedMaterial.name}</dd>
              </div>
              <div className="rounded-md bg-neutral-100 p-3">
                <dt className="text-neutral-500">Ponto</dt>
                <dd className="mt-1 font-semibold">{selectedPoint.name}</dd>
              </div>
              <div className="rounded-md bg-neutral-100 p-3">
                <dt className="text-neutral-500">Horario</dt>
                <dd className="mt-1 font-semibold">
                  {draft.desiredDate} - {selectedShift?.label} ({selectedShift?.window})
                </dd>
              </div>
            </dl>

            <div className="mt-6 rounded-lg bg-reward-100 p-4 text-sm text-reward-900">
              <strong>Impacto previsto:</strong> +{selectedMaterial.points} pontos ao confirmar a
              coleta concluida.
            </div>

            <button
              type="button"
              onClick={resetFlow}
              className="mt-6 min-h-touch w-full rounded-md bg-brand-600 px-4 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500"
            >
              Solicitar outra coleta
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-screen py-6 text-neutral-950">
      <div className="mx-auto grid max-w-dashboard gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card sm:p-6">
          <StepIndicator currentStep={currentStep} />

          <div className="mt-6">
            {currentStep === 1 ? (
              <MaterialStep
                materials={materialOptions}
                selectedMaterialId={draft.materialId}
                onSelect={selectMaterial}
              />
            ) : null}

            {currentStep === 2 && selectedMaterial ? (
              <PointStep
                points={collectionPoints}
                selectedMaterialId={selectedMaterial.id}
                selectedPointId={draft.pointId}
                selectedNeighborhood={selectedNeighborhood}
                neighborhoods={neighborhoodFilters}
                onNeighborhoodChange={setSelectedNeighborhood}
                onSelect={selectPoint}
              />
            ) : null}

            {currentStep === 3 && selectedMaterial && selectedPoint ? (
              <ScheduleStep
                draft={draft}
                material={selectedMaterial}
                point={selectedPoint}
                shifts={shiftOptions}
                onDateChange={setDesiredDate}
                onShiftChange={setShift}
                onNotesChange={setNotes}
              />
            ) : null}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 1}
              className="min-h-touch rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="min-h-touch rounded-md bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {currentStep === 3 ? 'Confirmar solicitacao' : 'Continuar'}
            </button>
          </div>
        </section>

        <aside className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card lg:sticky lg:top-6 lg:h-fit">
          <p className="text-sm font-semibold uppercase text-operational-700">Morador</p>
          <h2 className="mt-1 text-xl font-bold text-neutral-950">Solicitar coleta</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            O fluxo segue as 3 telas previstas no plano: material, ponto compativel e data com turno.
          </p>

          <div className="mt-5 grid gap-3 text-sm">
            <SummaryLine label="Material" value={selectedMaterial?.name ?? 'Nao escolhido'} />
            <SummaryLine label="Ponto" value={selectedPoint?.name ?? 'Nao escolhido'} />
            <SummaryLine label="Data" value={draft.desiredDate || 'Nao escolhida'} />
            <SummaryLine
              label="Turno"
              value={shiftOptions.find((shift) => shift.id === draft.shift)?.label ?? 'Nao escolhido'}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

interface SummaryLineProps {
  label: string;
  value: string;
}

function SummaryLine({ label, value }: SummaryLineProps) {
  return (
    <div className="rounded-md bg-neutral-100 p-3">
      <span className="block text-neutral-500">{label}</span>
      <strong className="mt-1 block text-neutral-950">{value}</strong>
    </div>
  );
}
