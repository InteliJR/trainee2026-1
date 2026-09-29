import { offlineApi } from './offlineApi';
import type { CollectorApi } from './types';

// A área do coletor fala sempre com a API real, passando pela fila offline.
export const api: CollectorApi = offlineApi;

export * from './types';
export { ApiError } from './errors';
