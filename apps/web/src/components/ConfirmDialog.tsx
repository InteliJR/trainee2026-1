import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  /** Opção segura: recebe o foco inicial. */
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel,
  confirmLabel,
  confirmVariant = 'primary',
  loading,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} role="alertdialog" busy={loading} onClose={onCancel}>
      {children && <div className="text-sm text-neutral-700">{children}</div>}
      <div className="flex flex-col gap-2">
        <Button size="lg" variant={confirmVariant} fullWidth onClick={onConfirm} loading={loading} loadingText="Aguarde…">
          {confirmLabel}
        </Button>
        <Button size="lg" variant="secondary" fullWidth onClick={onCancel} disabled={loading} data-autofocus>
          {cancelLabel}
        </Button>
      </div>
    </Dialog>
  );
}
