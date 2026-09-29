/**
 * Libera uma área só com sessão do papel certo; sem sessão, leva ao login da área guardando a rota de origem.
 * Se a API não responder, a tela abre assim mesmo e mostra seu próprio aviso de falta de conexão.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { SessionCheck } from '../lib/session';

interface RequireRoleProps {
  // Confere a sessão do papel da área (ex.: checkSession('OPERADOR')).
  check: () => Promise<SessionCheck>;
  loginPath: string;
  children: ReactNode;
}

export function RequireRole({ check, loginPath, children }: RequireRoleProps) {
  const location = useLocation();
  const [session, setSession] = useState<SessionCheck | null>(null);

  useEffect(() => {
    let active = true;
    void check().then((result) => {
      if (active) setSession(result);
    });
    return () => {
      active = false;
    };
  }, [check]);

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-screen">
        <p role="status" className="text-sm font-semibold text-neutral-700">Verificando seu acesso…</p>
      </main>
    );
  }
  if (session.kind === 'sem-sessao') {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
