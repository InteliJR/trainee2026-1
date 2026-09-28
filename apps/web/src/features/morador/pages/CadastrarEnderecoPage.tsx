import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { InlineNotice } from '../../../components/InlineNotice';
import { ApiError } from '../../../lib/api';
import { EcoPageHeader } from '../components/EcoPageHeader';
import { LocationPicker } from '../components/LocationPicker';
import { ResidentBottomNav } from '../components/ResidentBottomNav';
import { createAddress, validateAddress, type AddressForm, type AddressFormErrors } from '../lib/residentApi';

const INITIAL_FORM: AddressForm = {
  rotulo: 'Casa',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: 'São Paulo',
  estado: 'SP',
  referencia: '',
  padrao: true,
  localizacao: null,
};

// Cadastro do endereço onde o coletor retira o material. Depois de salvar, volta para a tela de origem.
export function CadastrarEnderecoPage() {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/morador/solicitar';
  const [form, setForm] = useState<AddressForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  // Atualiza um campo e apaga o erro dele, para o aviso sumir assim que a pessoa corrige.
  function update<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateAddress(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSubmitError('Confira os campos destacados.');
      return;
    }
    setSaving(true);
    setSubmitError('');
    try {
      await createAddress(form);
      navigate(from, { replace: true, state: { enderecoCadastrado: true } });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && error.status === 0
          ? 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível salvar o endereço. Tente de novo.',
      );
      setSaving(false);
    }
  }

  return (
    <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
      <div className="mx-auto max-w-app space-y-section">
        <EcoPageHeader
          eyebrow="Morador"
          title="Endereço da coleta"
          description="Informe onde o coletor deve retirar o material. Você só precisa fazer isso uma vez."
        />

        <form onSubmit={onSubmit} noValidate className="eco-panel space-y-4 rounded-lg p-5">
          {submitError ? <InlineNotice tone="error">{submitError}</InlineNotice> : null}

          <Field
            label="Nome do endereço"
            hint="Ex.: Casa, Trabalho"
            value={form.rotulo}
            error={errors.rotulo}
            maxLength={50}
            onChange={(event) => update('rotulo', event.target.value)}
          />
          <Field
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={form.cep}
            error={errors.cep}
            maxLength={9}
            onChange={(event) => update('cep', event.target.value)}
          />
          <Field
            label="Rua ou avenida"
            autoComplete="address-line1"
            value={form.logradouro}
            error={errors.logradouro}
            maxLength={180}
            onChange={(event) => update('logradouro', event.target.value)}
          />
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <Field
              label="Número"
              value={form.numero}
              error={errors.numero}
              maxLength={20}
              onChange={(event) => update('numero', event.target.value)}
            />
            <Field
              label="Complemento"
              optional
              autoComplete="address-line2"
              value={form.complemento}
              maxLength={100}
              onChange={(event) => update('complemento', event.target.value)}
            />
          </div>
          <Field
            label="Bairro"
            value={form.bairro}
            error={errors.bairro}
            maxLength={100}
            onChange={(event) => update('bairro', event.target.value)}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <Field
              label="Cidade"
              autoComplete="address-level2"
              value={form.cidade}
              error={errors.cidade}
              maxLength={100}
              onChange={(event) => update('cidade', event.target.value)}
            />
            <Field
              label="UF"
              autoComplete="address-level1"
              value={form.estado}
              error={errors.estado}
              maxLength={2}
              onChange={(event) => update('estado', event.target.value.toUpperCase())}
            />
          </div>
          <Field
            label="Ponto de referência"
            optional
            hint="Ajuda o coletor a encontrar: portaria, cor do portão…"
            value={form.referencia}
            maxLength={200}
            onChange={(event) => update('referencia', event.target.value)}
          />

          <LocationPicker
            value={form.localizacao}
            error={errors.localizacao}
            onChange={(value) => update('localizacao', value)}
          />

          <label className="flex min-h-touch items-center gap-3 text-sm text-neutral-800">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-600"
              checked={form.padrao}
              onChange={(event) => update('padrao', event.target.checked)}
            />
            Usar este endereço nas próximas coletas
          </label>

          <Button type="submit" size="lg" fullWidth loading={saving} loadingText="Salvando…">
            Salvar endereço
          </Button>
          <Link
            to={from}
            className="flex min-h-touch items-center justify-center text-sm font-semibold text-neutral-700 hover:text-brand-700"
          >
            Voltar sem salvar
          </Link>
        </form>
      </div>
      <ResidentBottomNav activeItem="solicitar" />
    </main>
  );
}
