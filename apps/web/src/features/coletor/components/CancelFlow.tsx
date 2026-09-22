import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface Props {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// RN01 — dupla confirmação. Só o segundo diálogo cancela de fato.
// Nos dois, o foco inicial fica na opção segura (manter a coleta).
export function CancelFlow({ open, loading, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!open) setStep(1);
  }, [open]);

  return (
    <>
      <ConfirmDialog
        open={open && step === 1}
        title="Cancelar esta coleta?"
        cancelLabel="Manter coleta"
        confirmLabel="Continuar"
        confirmVariant="danger"
        onCancel={onClose}
        onConfirm={() => setStep(2)}
      >
        A coleta sai da sua lista.
      </ConfirmDialog>

      <ConfirmDialog
        open={open && step === 2}
        title="Tem certeza? Não dá para desfazer."
        cancelLabel="Voltar"
        confirmLabel="Sim, cancelar coleta"
        confirmVariant="danger-solid"
        loading={loading}
        onCancel={() => setStep(1)}
        onConfirm={onConfirm}
      >
        Depois de cancelada, você não pode reabrir esta coleta.
      </ConfirmDialog>
    </>
  );
}
