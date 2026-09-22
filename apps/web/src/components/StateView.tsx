import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export function LoadingState({ label = 'Carregando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-200" />
      ))}
    </div>
  );
}

interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyProps) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-0 p-6 text-center">
      <p className="text-base font-semibold text-neutral-900">{title}</p>
      {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 p-4">
      <p className="flex items-start gap-2 text-sm font-medium text-danger-800">
        <Icon name="alert" className="mt-0.5 h-4 w-4" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <div className="mt-3">
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}
