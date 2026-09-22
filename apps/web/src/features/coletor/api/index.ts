import { httpApi } from './http';
import { mockApi } from './mock';
import type { CollectorApi } from './types';

// Mock ligado por padrão enquanto o backend não existe. VITE_USE_MOCK=false usa a API real.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const api: CollectorApi = USE_MOCK ? mockApi : httpApi;

export * from './types';
export { ApiError } from './errors';
