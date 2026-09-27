// Identidade mínima usada pelas autorizações: UUID confirmado e papel obtido no banco.
import type { UserRole } from '../generated/prisma/enums.js';

// Carrega apenas as informações necessárias para decidir acesso a um recurso.
export interface Actor {
  id: string;
  role: UserRole;
}
