import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EcoPageHeader } from '../components/EcoPageHeader';
import { MaterialStep } from '../components/MaterialStep';
import { Icon } from '../components/Icon';
import { PointStep } from '../components/PointStep';
import { ResidentBottomNav } from '../components/ResidentBottomNav';
import { ScheduleStep } from '../components/ScheduleStep';
import { StepIndicator } from '../components/StepIndicator';
import {
  materialOptions,
  shiftOptions,
} from '../data/mockSolicitacao';
import { fetchCollectionPoints } from '../lib/residentApi';
import { createResidentRequest, type CreateRequestResult } from '../lib/residentRequests';
import type { CollectionPoint, MaterialCategory, ResidentRequestDraft, Shift } from '../types';

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
  const [sending, setSending] = useState(false);
  const [submission, setSubmission] = useState<CreateRequestResult | null>(null);
  const [submitError, setSubmitError] = useState('');
  // Começa com os pontos de exemplo e troca pelos pontos reais da EcoRota assim que a API responder.
  const [points, setPoints] = useState<CollectionPoint[]>([]);
  const [pointsError, setPointsError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const apiPoints = await fetchCollectionPoints();
        if (active) setPoints(apiPoints);
      } catch (error) {
        if (active) setPointsError(error instanceof Error ? error.message : 'Não foi possível consultar os pontos de coleta.');
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const neighborhoods = useMemo(
    () => ['Todos', ...Array.from(new Set(points.map((point) => point.neighborhood))).sort()],
    [points],
  );

  const selectedMaterial = useMemo(
    () => materialOptions.find((material) => material.id === draft.materialId) ?? null,
    [draft.materialId],
  );

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === draft.pointId) ?? null,
    [draft.pointId, points],
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

  async function goNext() {
    if (currentStep === 3) {
      setSending(true);
      setSubmitError('');
      try {
        if (!selectedPoint) throw new Error('Selecione um ponto de coleta.');
        const result = await createResidentRequest(draft, selectedPoint);
        setSubmission(result);
        setSubmitted(true);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Não foi possível criar a solicitação.');
      } finally {
        setSending(false);
      }
      return;
    }

    setCurrentStep((step) => Math.min(3, step + 1));
  }

  function resetFlow() {
    setDraft(initialDraft);
    setCurrentStep(1);
    setSelectedNeighborhood('Todos');
    setSubmitted(false);
    setSubmission(null);
    setSubmitError('');
  }

  if (submitted && selectedMaterial && selectedPoint) {
    const selectedShift = shiftOptions.find((shift) => shift.id === draft.shift);

    return (
      <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-app flex-col justify-center">
          <section className="eco-panel rounded-lg p-6">
            <div className="flex items-center gap-3">
              <span className="eco-icon-tile flex h-12 w-12 items-center justify-center rounded-lg">
                <Icon name="cycle" className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold uppercase text-white">
                Ciclo iniciado
              </span>
            </div>
            <div aria-hidden="true" className="eco-confetti mt-5"><span>✦</span><span>✳</span><span>✦</span><span>✳</span><span>✦</span></div>
            <p className="mt-5 text-sm font-semibold uppercase text-brand-700">Solicitação criada</p>
            <h1 className="mt-2 text-3xl font-bold">Coleta agendada</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Vamos avisar quando um coletor assumir. Você também pode acompanhar o status pelo app.
            </p>
            {submission?.source === 'demo' ? (
              <p role="status" className="mt-4 rounded-md border border-reward-100 bg-reward-100/70 p-3 text-sm text-reward-900">
                API indisponível. Solicitação salva neste dispositivo em modo demonstração.
              </p>
            ) : (
              <p role="status" className="mt-4 rounded-md border border-neutral-200 bg-brand-50 p-3 text-sm text-brand-700">
                Solicitação enviada para a EcoRota. Protocolo {submission?.request.protocol}.
              </p>
            )}

            <dl className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-neutral-500">Material</dt>
                <dd className="text-right font-semibold">{selectedMaterial.name}</dd>
              </div>
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-neutral-500">Ponto</dt>
                <dd className="text-right font-semibold">{selectedPoint.name}</dd>
              </div>
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-neutral-500">Horário</dt>
                <dd className="text-right font-semibold">
              {draft.desiredDate} - {selectedShift?.label} ({selectedShift?.window})
                </dd>
              </div>
            </dl>

            <div className="mt-6 rounded-lg border border-reward-100 bg-earth-50 p-4 text-sm text-earth-700">
              <div className="flex gap-3">
                <Icon name="leaf" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                <p>
                  <strong>Impacto previsto:</strong> +{selectedMaterial.points} pontos ao confirmar a
                  coleta concluída.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/morador/acompanhar" className="eco-primary-button inline-flex min-h-touch items-center justify-center rounded-md px-4 text-sm font-bold text-white">
              Acompanhar coleta
            </Link>
            <Link to="/morador/historico" className="eco-secondary-button inline-flex min-h-touch items-center justify-center rounded-md border border-neutral-300 px-4 text-sm font-bold text-neutral-700">
              Ver histórico e impacto
            </Link>
            </div>
            <button
              type="button"
              onClick={resetFlow}
              className="eco-secondary-button mt-3 min-h-touch w-full rounded-md border border-neutral-300 px-4 text-sm font-bold text-neutral-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500"
            >
              Solicitar outra coleta
            </button>
          </section>
        </div>
        <ResidentBottomNav activeItem="solicitar" />
      </main>
    );
  }

  return (
    <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
      <div className="mx-auto grid max-w-dashboard gap-section lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-6">
          <EcoPageHeader
            description="Separe o material, escolha um ponto compatível e agende o melhor turno para fechar o ciclo do descarte."
            eyebrow="Morador"
            metric="3 etapas"
            metricLabel="fluxo guiado"
            title="Solicitar coleta"
          />
          <StepIndicator currentStep={currentStep} />

          {pointsError && <p role="alert" className="rounded-md bg-danger-50 p-3 text-danger-800">{pointsError}</p>}
          {!pointsError && points.length === 0 && <p role="status" className="rounded-md bg-neutral-0 p-3 text-neutral-700">Nenhum ponto de coleta disponível. A operação precisa cadastrar e ativar um ponto.</p>}

          <div>
            {currentStep === 1 ? (
              <MaterialStep
                materials={materialOptions}
                selectedMaterialId={draft.materialId}
                onSelect={selectMaterial}
              />
            ) : null}

            {currentStep === 2 && selectedMaterial ? (
              <PointStep
                points={points}
                selectedMaterialId={selectedMaterial.id}
                selectedPointId={draft.pointId}
                selectedNeighborhood={selectedNeighborhood}
                neighborhoods={neighborhoods}
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

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 1}
              className="eco-secondary-button inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-bold text-neutral-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="arrow-left" className="h-4 w-4" />
              Voltar
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue || sending}
              className="eco-primary-button inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-5 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500 disabled:cursor-not-allowed disabled:bg-none disabled:bg-neutral-300"
            >
              {sending ? 'Enviando...' : currentStep === 3 ? 'Confirmar solicitação' : 'Continuar'}
              <Icon name={currentStep === 3 ? 'check' : 'arrow-right'} className="h-4 w-4" />
            </button>
          </div>
          {submitError ? <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-800">{submitError}</p> : null}
        </section>

        <aside className="eco-panel rounded-lg p-4 lg:sticky lg:top-6 lg:h-fit">
          <div className="flex items-center gap-3">
            <span className="eco-icon-tile flex h-10 w-10 items-center justify-center rounded-lg">
              <Icon name="leaf" className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold uppercase text-operational-700">Resumo</p>
          </div>
          <h2 className="mt-1 text-xl font-bold text-neutral-950">Sua coleta</h2>

          <div className="mt-5 grid gap-3 text-sm">
            <SummaryLine icon="trash" label="Material" value={selectedMaterial?.name ?? 'Não escolhido'} />
            <SummaryLine icon="map-pin" label="Ponto" value={selectedPoint?.name ?? 'Não escolhido'} />
            <SummaryLine icon="calendar" label="Data" value={draft.desiredDate || 'Não escolhida'} />
            <SummaryLine
              icon="clock"
              label="Turno"
              value={shiftOptions.find((shift) => shift.id === draft.shift)?.label ?? 'Não escolhido'}
            />
          </div>
        </aside>
      </div>
      <ResidentBottomNav activeItem="solicitar" />
    </main>
  );
}

interface SummaryLineProps {
  icon: 'calendar' | 'clock' | 'home' | 'map-pin' | 'trash';
  label: string;
  value: string;
}

function SummaryLine({ icon, label, value }: SummaryLineProps) {
  return (
    <div className="flex gap-3 border-t border-neutral-200 py-3 first:border-t-0">
      <span className="mt-0.5 text-operational-700">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-neutral-500">{label}</span>
        <strong className="mt-1 block text-neutral-950">{value}</strong>
      </span>
    </div>
  );
}
