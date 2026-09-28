// Erro de aplicação com status HTTP, código estável, mensagem pública e detalhes opcionais.
export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

// Mantém dados públicos do erro separados da pilha e dos detalhes internos da exceção.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  // Copia os campos públicos e mantém o nome da classe para identificação no handler.
  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details ?? null;
  }
}
