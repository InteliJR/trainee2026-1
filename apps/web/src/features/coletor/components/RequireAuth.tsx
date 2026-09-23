import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../../../components/StateView';
import { useAuth } from '../auth/AuthContext';

// Área do coletor só para quem fez login (RNF05). Guarda a rota de origem para voltar depois de entrar.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { collector, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-app px-screen py-section">
        <LoadingState label="Verificando seu acesso…" rows={1} />
      </div>
    );
  }
  if (!collector) return <Navigate to="/coletor/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
