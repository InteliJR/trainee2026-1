import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface Props {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// Dupla confirmação (mesmo padrão de CancelFlow): depois de confirmada, não dá para desfazer.
// Só o segundo diálogo confirma de fato. Foco inicial sempre na opção segura (voltar).
export function CompleteFlow({ open, loading, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!open) setStep(1);
  }, [open]);

  return (
    <>
      <ConfirmDialog
        open={open && step === 1}
        title="Confirmar que a coleta foi feita?"
        cancelLabel="Voltar"
        confirmLabel="Continuar"
        onCancel={onClose}
        onConfirm={() => setStep(2)}
      >
        Confira se recolheu tudo antes de continuar.
      </ConfirmDialog>

      <ConfirmDialog
        open={open && step === 2}
        title="Tem certeza? Não dá para desfazer."
        cancelLabel="Voltar"
        confirmLabel="Sim, confirmar coleta"
        loading={loading}
        onCancel={() => setStep(1)}
        onConfirm={onConfirm}
      >
        Depois de confirmada, a coleta é encerrada.
      </ConfirmDialog>
    </>
  );
}
