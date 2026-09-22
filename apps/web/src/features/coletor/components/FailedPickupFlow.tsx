import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { ChoiceGroup } from '../../../components/ChoiceGroup';
import { Dialog } from '../../../components/Dialog';
import { ErrorText, TextAreaField, focusFirstInvalid } from '../../../components/Field';
import type { PickupIssueReport } from '../api';
import { ISSUE_REASONS, RESCHEDULE_MAX_DAYS, RESCHEDULE_MIN_DAYS, type PickupIssueReason } from '../config';
import { formatDateBR, isoDateIn } from '../lib/dates';

interface Props {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (report: PickupIssueReport) => void;
}

type Next = 'reschedule' | 'close';

const NEXT_CHOICES = [
  { value: 'reschedule' as const, label: 'Tentar em outro dia', description: 'A coleta volta para a fila na nova data.' },
  { value: 'close' as const, label: 'Encerrar a coleta', description: 'A coleta sai da sua lista e não será refeita.' },
];

const REASON_CHOICES = ISSUE_REASONS.map(({ id, label, description }) => ({ value: id, label, description }));

// Coleta não realizada (Task 3.3): um passo só, com motivo em opções grandes e reagendamento opcional.
// O motivo fala do PONTO DE COLETA — o coletor vai ao ponto, não à casa do morador.
// A ação destrutiva ("Encerrar a coleta") nunca é a escolha padrão.
export function FailedPickupFlow({ open, loading, onClose, onConfirm }: Props) {
  const minDate = isoDateIn(RESCHEDULE_MIN_DAYS);
  const maxDate = isoDateIn(RESCHEDULE_MAX_DAYS);

  const [reason, setReason] = useState<PickupIssueReason>();
  const [details, setDetails] = useState('');
  const [next, setNext] = useState<Next>('reschedule');
  const [date, setDate] = useState(minDate);
  const [errors, setErrors] = useState<{ reason?: string; details?: string; date?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Cada abertura começa do zero: nada do registro anterior fica na tela.
  useEffect(() => {
    if (!open) return;
    setReason(undefined);
    setDetails('');
    setNext('reschedule');
    setDate(isoDateIn(RESCHEDULE_MIN_DAYS));
    setErrors({});
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!reason) found.reason = 'Escolha o que aconteceu.';
    if (reason === 'other' && !details.trim()) found.details = 'Escreva o motivo em poucas palavras.';
    if (next === 'reschedule') {
      if (!date) found.date = 'Escolha a nova data.';
      else if (date < minDate) found.date = `A nova data precisa ser a partir de ${formatDateBR(minDate)}.`;
      else if (date > maxDate) found.date = `A nova data precisa ser até ${formatDateBR(maxDate)}.`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    onConfirm({
      reason: reason!,
      details: reason === 'other' ? details.trim() : undefined,
      rescheduleDate: next === 'reschedule' ? date : undefined,
    });
  }

  return (
    <Dialog open={open} title="Não deu para coletar?" busy={loading} onClose={onClose}>
      <form ref={formRef} onSubmit={submit} className="space-y-5" noValidate>
        <ChoiceGroup
          legend="O que aconteceu?"
          choices={REASON_CHOICES}
          value={reason}
          error={errors.reason}
          onChange={(value) => {
            setReason(value);
            setErrors((e) => ({ ...e, reason: undefined }));
          }}
          renderExtra={(value) =>
            value === 'other' ? (
              <TextAreaField
                label="Conte o que houve"
                rows={3}
                maxLength={200}
                value={details}
                error={errors.details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  setErrors((prev) => ({ ...prev, details: undefined }));
                }}
              />
            ) : null
          }
        />

        <ChoiceGroup
          legend="E agora?"
          choices={NEXT_CHOICES}
          value={next}
          onChange={(value) => {
            setNext(value);
            setErrors((e) => ({ ...e, date: undefined }));
          }}
          renderExtra={(value) =>
            value === 'reschedule' ? (
              <div>
                <label htmlFor="issue-date" className="mb-1 block text-base font-semibold text-neutral-900">
                  Nova data
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={errors.date ? 'issue-date-error' : undefined}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setErrors((prev) => ({ ...prev, date: undefined }));
                  }}
                  className={`block w-full min-h-touch-lg rounded-md border-2 bg-neutral-0 px-3 text-base text-neutral-900 ${
                    errors.date ? 'border-danger-600' : 'border-neutral-500'
                  }`}
                />
                {errors.date && <ErrorText id="issue-date-error">{errors.date}</ErrorText>}
              </div>
            ) : null
          }
        />

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            size="lg"
            fullWidth
            variant={next === 'close' ? 'danger-solid' : 'primary'}
            loading={loading}
            loadingText="Registrando…"
          >
            {next === 'close' ? 'Registrar e encerrar' : 'Registrar e remarcar'}
          </Button>
          <Button size="lg" variant="secondary" fullWidth disabled={loading} onClick={onClose} data-autofocus>
            Voltar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
