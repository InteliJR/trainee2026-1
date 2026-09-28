/**
 * Libera as telas do coletor só com sessão de coletor; sem sessão, leva ao login guardando a rota de origem.
 */
import type { ReactNode } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { checkCollectorSession } from '../lib/collectorAuth';

export function RequireCollector({ children }: { children: ReactNode }) {
  return (
    <RequireRole check={checkCollectorSession} loginPath="/coletor/login">
      {children}
    </RequireRole>
  );
}
