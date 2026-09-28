/** Define entradas TypeScript e JSON Schemas dos endpoints públicos de autenticação. */

// Restringe cadastro público a moradores e coletores; operadores são provisionados administrativamente.
export type PublicRegistrationRole = 'MORADOR' | 'COLETOR';

// Descreve os campos enviados para criar uma conta.
export interface RegisterInput {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
  papel: PublicRegistrationRole;
}

// Descreve as credenciais mínimas aceitas pelo login.
export interface LoginInput {
  email: string;
  senha: string;
}

// Valida tamanho, formato e lista fechada antes que o serviço execute hash ou banco.
export const registerSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nome', 'email', 'senha', 'papel'],
  properties: {
    nome: { type: 'string', minLength: 2, maxLength: 120 },
    email: { type: 'string', format: 'email', maxLength: 254 },
    telefone: { type: 'string', minLength: 8, maxLength: 30 },
    senha: { type: 'string', minLength: 8, maxLength: 72 },
    papel: { type: 'string', enum: ['MORADOR', 'COLETOR'] },
  },
} as const;

// Rejeita campos extras e credenciais estruturalmente inválidas no login.
export const loginSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'senha'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    senha: { type: 'string', minLength: 1, maxLength: 72 },
  },
} as const;
