import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { ChoiceGroup } from '../../../components/ChoiceGroup';
import { Dialog } from '../../../components/Dialog';
import { TextAreaField, focusFirstInvalid } from '../../../components/Field';
import { ISSUE_REASONS, issueReasonLabel, type PickupIssueReason } from '../config';

interface Props {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  /** Motivo já formatado, pronto para POST .../cancelamento. */
  onConfirm: (reason: string) => void;
}

const REASON_CHOICES = ISSUE_REASONS.map(({ id, label, description }) => ({ value: id, label, description }));

// Coleta não realizada (Task 3.3): motivo em opções grandes, sem digitação exceto em "Outro".
// A API real não tem reagendamento — isso sempre cancela a coleta (POST .../cancelamento).
export function FailedPickupFlow({ open, loading, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<PickupIssueReason>();
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);

  // Cada abertura começa do zero: nada do registro anterior fica na tela.
  useEffect(() => {
    if (!open) return;
    setReason(undefined);
    setDetails('');
    setError(undefined);
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError('Escolha o que aconteceu.');
      focusFirstInvalid(formRef.current);
      return;
    }
    if (reason === 'other' && !details.trim()) {
      setError('Escreva o motivo em poucas palavras.');
      focusFirstInvalid(formRef.current);
      return;
    }
    const label = reason === 'other' ? details.trim() : issueReasonLabel(reason);
    onConfirm(`Não coletado: ${label}`);
  }

  return (
    <Dialog open={open} title="Não deu para coletar?" busy={loading} onClose={onClose}>
      <form ref={formRef} onSubmit={submit} className="space-y-5" noValidate>
        <ChoiceGroup
          legend="O que aconteceu?"
          choices={REASON_CHOICES}
          value={reason}
          error={error}
          onChange={(value) => {
            setReason(value);
            setError(undefined);
          }}
          renderExtra={(value) =>
            value === 'other' ? (
              <TextAreaField
                label="Conte o que houve"
                rows={3}
                maxLength={200}
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  setError(undefined);
                }}
              />
            ) : null
          }
        />

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" fullWidth variant="danger-solid" loading={loading} loadingText="Registrando…">
            Registrar e cancelar
          </Button>
          <Button size="lg" variant="secondary" fullWidth disabled={loading} onClick={onClose} data-autofocus>
            Voltar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
