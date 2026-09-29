/**
 * Libera as telas do morador só com sessão de morador; sem sessão, leva ao login guardando a rota de origem.
 * Se a API não responder, as telas abrem e mostram o erro de conexão; não há dados de exemplo.
 */
import type { ReactNode } from 'react';
import { RequireRole } from '../../../components/RequireRole';
import { checkResidentSession } from '../lib/residentAuth';

export function RequireResident({ children }: { children: ReactNode }) {
  return (
    <RequireRole check={checkResidentSession} loginPath="/morador/login">
      {children}
    </RequireRole>
  );
}
