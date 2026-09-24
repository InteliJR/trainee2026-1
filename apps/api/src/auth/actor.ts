import type { UserRole } from '../generated/prisma/enums.js';

export interface Actor {
  id: string;
  role: UserRole;
}

