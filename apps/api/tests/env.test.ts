import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/config/validateEnv.js';

describe('validação do ambiente', () => {
  it('aceita uma configuração mínima válida', () => {
    const result = validateEnvironment({
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://usuario:senha@localhost:5432/ecorota',
      DIRECT_URL: 'postgresql://usuario:senha@localhost:5432/ecorota',
    });

    expect(result.nodeEnv).toBe('test');
    expect(result.port).toBe(3000);
  });

  it('rejeita URL HTTP como conexão do PostgreSQL', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: 'https://projeto.supabase.co' }),
    ).toThrow('DATABASE_URL deve ser uma URI PostgreSQL');
  });

  it('rejeita porta fora do intervalo permitido', () => {
    expect(() =>
      validateEnvironment({
        PORT: '70000',
        DATABASE_URL: 'postgresql://usuario:senha@localhost:5432/ecorota',
      }),
    ).toThrow('PORT deve ser um número inteiro entre 1 e 65535');
  });
});
