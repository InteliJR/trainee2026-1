import { Icon } from './Icon';

interface StepIndicatorProps {
  currentStep: number;
}

const steps = ['Material', 'Ponto', 'Data'];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <ol className="eco-card grid grid-cols-3 gap-2 rounded-lg p-3" aria-label="Etapas da solicitação">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCurrent = stepNumber === currentStep;
        const isDone = stepNumber < currentStep;

        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isCurrent || isDone ? 'bg-brand-600 text-white shadow-card' : 'bg-earth-50 text-earth-700',
              ].join(' ')}
            >
              {isDone ? <Icon name="check" className="h-4 w-4" /> : stepNumber}
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
