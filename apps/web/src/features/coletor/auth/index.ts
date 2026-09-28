import { USE_MOCK } from '../api';
import { httpAuth } from './http';
import { mockAuth } from './mock';
import type { AuthApi } from './types';

export const authApi: AuthApi = USE_MOCK ? mockAuth : httpAuth;

export * from './types';
