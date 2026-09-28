/**
 * Libera as telas do morador só com sessão de morador; sem sessão, leva ao login guardando a rota de origem.
 * Se a API não responder, as telas seguem em modo demonstração, como no fluxo original sem backend.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { checkResidentSession, type ResidentSession } from '../lib/residentAuth';

export function RequireResident({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [session, setSession] = useState<ResidentSession | null>(null);

  useEffect(() => {
    let active = true;
    void checkResidentSession().then((result) => {
      if (active) setSession(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!session) {
    return (
      <main className="eco-page flex min-h-screen items-center justify-center px-screen">
        <p role="status" className="text-sm font-semibold text-brand-700">Verificando seu acesso…</p>
      </main>
    );
  }
  if (session.kind === 'sem-sessao') {
    return <Navigate to="/morador/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
