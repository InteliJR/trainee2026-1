import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Field, PasswordField } from '../../../components/Field';
import { InlineNotice } from '../../../components/InlineNotice';
import { Icon } from '../components/Icon';
import { ResidentApiError } from '../lib/residentApi';
import { loginResident } from '../lib/residentAuth';

// Traduz falhas do login em mensagens curtas para o morador.
function loginErrorMessage(error: unknown): string {
  if (error instanceof ResidentApiError) {
    if (error.status === 401) return 'E-mail ou senha incorretos.';
    if (error.status === 0) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
    return error.message;
  }
  return 'Não foi possível entrar agora. Tente de novo.';
}

// Login do morador. Depois de entrar, volta para a tela que pediu o acesso (ou para "Solicitar").
export function LoginMoradorPage() {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/morador';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await loginResident(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
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
          <h1 className="mt-1 text-3xl font-bold">Entrar no EcoRota</h1>
          <p className="mt-2 text-sm leading-6 text-white/90">
            Solicite coletas, acompanhe o coletor ao vivo e veja o impacto do que você recicla.
          </p>
        </header>

        <form onSubmit={onSubmit} className="eco-panel mt-4 space-y-4 rounded-lg p-5">
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <Field
            label="E-mail"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordField
            label="Senha"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Entrando…">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
