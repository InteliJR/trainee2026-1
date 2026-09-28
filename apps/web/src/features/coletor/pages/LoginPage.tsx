import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Field, PasswordField } from '../../../components/Field';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
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
      setError(statusOf(err) === 401 ? MESSAGES.wrongCredentials : friendlyError(err, MESSAGES.actionError));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-app space-y-section px-screen py-section">
      <div className="space-y-1">
        <PageTitle>Entrar</PageTitle>
        <p className="text-lg text-neutral-700">Use o e-mail cadastrado pelo time EcoRota.</p>
      </div>

      {USE_MOCK && (
        <InlineNotice tone="info">
          Ambiente de teste: {MOCK_COLLECTOR.email} / {MOCK_COLLECTOR.password}
        </InlineNotice>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
        <Field label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Senha" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Entrando…">
          Entrar
        </Button>
      </form>
    </div>
  );
}
