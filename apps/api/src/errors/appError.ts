export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details ?? null;
  }
}
