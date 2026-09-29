import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { Dialog } from '../../components/Dialog';
import { Field, TextAreaField, focusFirstInvalid } from '../../components/Field';
import { InlineNotice } from '../../components/InlineNotice';
import {
  EMPTY_POINT_FORM,
  pointInputFromForm,
  validateCollectionPointForm,
  type CollectionPointFormErrors,
  type CollectionPointFormValues,
} from './collectionPointValidation';
import type { CollectionPointInput } from './collectionPointsApi';

interface Props {
  open: boolean;
  title: string;
  initialValues?: CollectionPointFormValues;
  loading?: boolean;
  apiError?: string;
  onClose: () => void;
  onSubmit: (input: CollectionPointInput) => Promise<void>;
}

const TYPE_CHOICES = [
  { value: 'ADICIONAL', label: 'Adicional', description: 'Ponto criado para ampliar a cobertura.' },
  { value: 'HABITUAL', label: 'Habitual', description: 'Ponto fixo de um circuito recorrente.' },
] as const;

export function CollectionPointForm({ open, title, initialValues, loading, apiError, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<CollectionPointFormValues>(initialValues ?? EMPTY_POINT_FORM);
  const [errors, setErrors] = useState<CollectionPointFormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const initialKey = JSON.stringify(initialValues ?? EMPTY_POINT_FORM);
  const [renderKey, setRenderKey] = useState(initialKey);
  if (renderKey !== initialKey) {
    setRenderKey(initialKey);
    setValues(initialValues ?? EMPTY_POINT_FORM);
    setErrors({});
  }

  function set<K extends keyof CollectionPointFormValues>(key: K, value: CollectionPointFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCollectionPointForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    await onSubmit(pointInputFromForm(values));
  }

  return (
    <Dialog open={open} title={title} busy={loading} wide onClose={onClose}>
      <form ref={formRef} onSubmit={(event) => void submit(event)} className="space-y-5">
        {apiError ? <InlineNotice tone="error">{apiError}</InlineNotice> : null}
        <Field
          label="Nome do ponto"
          required
          value={values.nome}
          error={errors.nome}
          onChange={(event) => set('nome', event.target.value)}
          data-autofocus
        />
        <ChoiceGroup
          legend="Tipo do ponto"
          choices={TYPE_CHOICES}
          value={values.tipo}
          onChange={(value) => set('tipo', value)}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Circuito" type="number" min="1" step="1" required value={values.circuito} error={errors.circuito} onChange={(event) => set('circuito', event.target.value)} />
          <Field label="Latitude" type="number" min="-90" max="90" step="any" required value={values.latitude} error={errors.latitude} onChange={(event) => set('latitude', event.target.value)} />
          <Field label="Longitude" type="number" min="-180" max="180" step="any" required value={values.longitude} error={errors.longitude} onChange={(event) => set('longitude', event.target.value)} />
        </div>
        <TextAreaField label="Descrição" optional rows={3} maxLength={500} value={values.descricao} error={errors.descricao} hint={`${values.descricao.length}/500 caracteres`} onChange={(event) => set('descricao', event.target.value)} />
        <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-neutral-300 bg-neutral-0 p-3 text-sm text-neutral-800">
          <input type="checkbox" checked={values.ativo} onChange={(event) => set('ativo', event.target.checked)} className="h-5 w-5 accent-brand-600" />
          <span><strong className="block text-neutral-900">Ponto ativo</strong>Disponível no catálogo administrativo.</span>
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" size="lg" loading={loading} loadingText="Salvando…">Salvar ponto</Button>
        </div>
      </form>
    </Dialog>
  );
}
