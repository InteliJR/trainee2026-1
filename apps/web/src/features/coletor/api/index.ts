import { offlineApi } from './offlineApi';
import { mockApi } from './mock';
import type { CollectorApi } from './types';

// A API real usa a fila offline; o mock só é usado quando solicitado explicitamente.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const api: CollectorApi = USE_MOCK ? mockApi : offlineApi;

export * from './types';
export { ApiError } from './errors';
