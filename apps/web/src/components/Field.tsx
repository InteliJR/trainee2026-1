import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

const CONTROL =
  'block w-full min-h-touch rounded-md border bg-neutral-0 px-3 text-base text-neutral-900 placeholder:text-neutral-500';

const borderFor = (error?: string) => (error ? 'border-danger-600' : 'border-neutral-500');

interface ShellProps {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}

function FieldShell({ id, label, optional, hint, error, children }: ShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-800">
        {label}
        {optional && <span className="font-normal text-neutral-600"> (opcional)</span>}
      </label>
      {children(describedBy)}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-sm text-neutral-600">
          {hint}
        </p>
      )}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

/** Mensagem de erro de campo/grupo: ícone + texto (nunca só cor). */
export function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 flex items-start gap-1 text-sm font-medium text-danger-700">
      <Icon name="alert" className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </p>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  /** Conteúdo à direita dentro do campo (ex.: mostrar/ocultar senha). */
  trailing?: ReactNode;
}

export function Field({ label, error, hint, optional, trailing, className = '', ...input }: FieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      {(describedBy) => (
        <div className="relative">
          <input
            {...input}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${CONTROL} ${borderFor(error)} ${trailing ? 'pr-12' : ''} ${className}`}
          />
          {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
        </div>
      )}
    </FieldShell>
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

export function TextAreaField({ label, error, hint, optional, className = '', ...input }: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      {(describedBy) => (
        <textarea
          {...input}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${CONTROL} ${borderFor(error)} py-2 ${className}`}
        />
      )}
    </FieldShell>
  );
}

type PasswordFieldProps = Omit<FieldProps, 'type' | 'trailing'>;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-md text-neutral-700 hover:text-neutral-900"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      }
    />
  );
}

/** Leva o foco ao primeiro campo inválido do formulário (chamar após setar os erros). */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
