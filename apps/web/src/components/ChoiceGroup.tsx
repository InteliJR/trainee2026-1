import { useId, type ReactNode } from 'react';
import { ErrorText } from './Field';

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Linha de apoio, quando o rótulo sozinho não basta. */
  description?: string;
}

interface Props<T extends string> {
  legend: string;
  choices: readonly Choice<T>[];
  value?: T;
  error?: string;
  name?: string;
  onChange: (value: T) => void;
  /** Conteúdo extra logo abaixo da opção escolhida (ex.: campo de "Outro"). */
  renderExtra?: (value: T) => ReactNode;
}

// Escolha única em cartões grandes (RNF08: alvo de toque generoso, texto direto, nunca só cor).
// O radio nativo continua lá — teclado e leitor de tela funcionam sem gambiarra.
export function ChoiceGroup<T extends string>({ legend, choices, value, error, name, onChange, renderExtra }: Props<T>) {
  const id = useId();
  const groupName = name ?? id;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <fieldset aria-invalid={error ? true : undefined} aria-describedby={errorId}>
      <legend className="mb-2 text-base font-semibold text-neutral-900">{legend}</legend>
      <div className="space-y-2">
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <div key={choice.value}>
              <label
                className={`flex min-h-touch-lg cursor-pointer items-start gap-3 rounded-md border-2 p-3 text-base ${
                  selected ? 'border-brand-600 bg-brand-50' : 'border-neutral-300 bg-neutral-0 hover:bg-neutral-100'
                }`}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={choice.value}
                  checked={selected}
                  onChange={() => onChange(choice.value)}
                  className="mt-1 h-5 w-5 accent-brand-600"
                />
                <span>
                  <span className="font-semibold text-neutral-900">{choice.label}</span>
                  {choice.description && <span className="block text-sm text-neutral-700">{choice.description}</span>}
                </span>
              </label>
              {selected && renderExtra && <div className="mt-2">{renderExtra(choice.value)}</div>}
            </div>
          );
        })}
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </fieldset>
  );
}
