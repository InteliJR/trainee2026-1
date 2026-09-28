// Restringe o Vitest aos arquivos tests/**/*.test.ts da API.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
