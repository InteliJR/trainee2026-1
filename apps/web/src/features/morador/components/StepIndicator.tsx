interface StepIndicatorProps {
  currentStep: number;
}

const steps = ['Material', 'Ponto', 'Data'];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da solicitacao">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCurrent = stepNumber === currentStep;
        const isDone = stepNumber < currentStep;

        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                isCurrent || isDone ? 'bg-brand-600 text-white' : 'bg-neutral-200 text-neutral-600',
              ].join(' ')}
            >
              {isDone ? 'OK' : stepNumber}
            </span>
            <span
              className={[
                'hidden text-sm font-semibold sm:inline',
                isCurrent ? 'text-neutral-950' : 'text-neutral-500',
              ].join(' ')}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
