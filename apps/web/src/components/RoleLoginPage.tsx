/**
 * Tela de login por papel (morador, operador): cabeçalho da marca, e-mail, senha e erro acima dos campos.
 * Depois de entrar, volta para a tela que pediu o acesso ou para o destino padrão da área.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginErrorMessage } from '../lib/session';
import { Button } from './Button';
import { Field, PasswordField } from './Field';
import { InlineNotice } from './InlineNotice';

interface RoleLoginPageProps {
  // Rótulo curto acima do título, com o nome da área.
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  // Para onde ir quando o login não veio de uma rota protegida.
  defaultRedirect: string;
  // Faz o login e confere o papel; lança erro com mensagem para a tela.
  onLogin: (email: string, password: string) => Promise<unknown>;
  // Link para cadastro, quando a área permite conta própria (hoje só o morador).
  registerHref?: string;
}

export function RoleLoginPage({ eyebrow, title, description, icon, defaultRedirect, onLogin, registerHref }: RoleLoginPageProps) {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? defaultRedirect;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onLogin(email, password);
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
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15">{icon}</span>
          <p className="mt-4 text-sm font-semibold uppercase text-white/80">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-white/90">{description}</p>
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

        {registerHref ? (
          <p className="mt-4 flex min-h-touch items-center justify-center text-sm font-semibold text-neutral-700">
            Ainda não tem conta?
            <Link to={registerHref} className="ml-1 text-brand-700 hover:text-brand-800">
              Cadastre-se
            </Link>
          </p>
        ) : null}

        <Link
          to="/"
          className="mt-2 flex min-h-touch items-center justify-center text-sm font-semibold text-neutral-700 hover:text-brand-700"
        >
          Trocar de perfil
        </Link>
      </div>
    </main>
  );
}
