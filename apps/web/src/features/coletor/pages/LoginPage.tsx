import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Field, PasswordField } from '../../../components/Field';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { USE_MOCK } from '../api';
import { useAuth } from '../auth/AuthContext';
import { MOCK_COLLECTOR } from '../auth/mock';
import { MESSAGES, friendlyError, statusOf } from '../lib/messages';

// Login do coletor (RF01/RF02). Sem cadastro: coletores custom são cadastrados pelo time.
export default function LoginPage() {
  const { collector, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/coletor';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  if (collector) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const status = statusOf(err);
      setError(
        status === 401 ? MESSAGES.wrongCredentials : status === 403 ? MESSAGES.wrongRole : friendlyError(err, MESSAGES.actionError),
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="eco-page flex min-h-screen flex-col justify-center px-screen py-section text-neutral-950">
      <div className="mx-auto w-full max-w-app">
        <header className="eco-hero rounded-lg p-5 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15">
            <Icon name="truck" className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold uppercase text-white/80">Coletor</p>
          <h1 className="mt-1 text-3xl font-bold">Entrar no EcoRota</h1>
          <p className="mt-2 text-sm leading-6 text-white/90">
            Veja as coletas do dia, atualize o status de cada uma e organize sua disponibilidade.
          </p>
        </header>

        <form onSubmit={onSubmit} className="eco-panel mt-4 space-y-4 rounded-lg p-5">
          {USE_MOCK && (
            <InlineNotice tone="info">
              Ambiente de teste: {MOCK_COLLECTOR.email} / {MOCK_COLLECTOR.password}
            </InlineNotice>
          )}
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
          <Field label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordField label="Senha" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Entrando…">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
