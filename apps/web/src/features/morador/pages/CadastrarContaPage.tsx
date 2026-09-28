/**
 * Cadastro de conta do morador: POST /autenticacao/cadastro (papel MORADOR).
 * O cadastro não inicia sessão sozinho (auth.routes.ts), então logamos em seguida com as mesmas
 * credenciais e seguimos direto para o cadastro de endereço, sem pedir login de novo.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Field, PasswordField } from '../../../components/Field';
import { InlineNotice } from '../../../components/InlineNotice';
import { ApiError, apiRequest } from '../../../lib/api';
import { Icon } from '../components/Icon';
import { loginResident } from '../lib/residentAuth';

interface RegisterForm {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
}

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const INITIAL_FORM: RegisterForm = { nome: '', email: '', telefone: '', senha: '' };

// Mesmas regras do registerSchema da API, para o erro aparecer no campo certo antes de chamar o backend.
function validate(form: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};
  if (form.nome.trim().length < 2) errors.nome = 'Informe seu nome completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Informe um e-mail válido.';
  if (form.telefone.trim() && form.telefone.trim().length < 8) errors.telefone = 'Informe um telefone válido, ou deixe em branco.';
  if (form.senha.length < 8) errors.senha = 'A senha precisa ter pelo menos 8 caracteres.';
  return errors;
}

function registerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
    return error.message;
  }
  return 'Não foi possível criar a conta agora. Tente de novo.';
}

export function CadastrarContaPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof RegisterForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await apiRequest('POST', '/autenticacao/cadastro', {
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim() || undefined,
        senha: form.senha,
        papel: 'MORADOR',
      });
      await loginResident(form.email.trim(), form.senha);
      navigate('/morador/enderecos/novo', { state: { from: '/morador/solicitar' } });
    } catch (error) {
      setSubmitError(registerErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <main className="eco-page flex min-h-screen flex-col justify-center px-screen py-section text-neutral-950">
      <div className="mx-auto w-full max-w-app">
        <header className="eco-hero rounded-lg p-5 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15">
            <Icon name="leaf" className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold uppercase text-white/80">Morador</p>
          <h1 className="mt-1 text-3xl font-bold">Criar conta</h1>
          <p className="mt-2 text-sm leading-6 text-white/90">
            Cadastre-se para solicitar coletas, acompanhar o coletor e ver o impacto do que você recicla.
          </p>
        </header>

        <form onSubmit={onSubmit} className="eco-panel mt-4 space-y-4 rounded-lg p-5" noValidate>
          {submitError ? <InlineNotice tone="error">{submitError}</InlineNotice> : null}
          <Field
            label="Nome completo"
            autoComplete="name"
            required
            error={errors.nome}
            value={form.nome}
            onChange={(event) => update('nome', event.target.value)}
          />
          <Field
            label="E-mail"
            type="email"
            autoComplete="username"
            required
            error={errors.email}
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
          />
          <Field
            label="Telefone"
            type="tel"
            autoComplete="tel"
            optional
            hint="Só usamos para avisos sobre a coleta."
            error={errors.telefone}
            value={form.telefone}
            onChange={(event) => update('telefone', event.target.value)}
          />
          <PasswordField
            label="Senha"
            autoComplete="new-password"
            required
            hint="Pelo menos 8 caracteres."
            error={errors.senha}
            value={form.senha}
            onChange={(event) => update('senha', event.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Criando conta…">
            Criar conta
          </Button>
        </form>

        <Link
          to="/morador/login"
          className="mt-4 flex min-h-touch items-center justify-center text-sm font-semibold text-neutral-700 hover:text-brand-700"
        >
          Já tem conta? <span className="ml-1 text-brand-700">Entrar</span>
        </Link>
      </div>
    </main>
  );
}
