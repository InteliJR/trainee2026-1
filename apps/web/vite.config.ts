// Importa a função que valida e oferece autocomplete para a configuração do Vite.
import { defineConfig } from 'vite';
// Importa o plugin que transforma JSX e habilita o fluxo de desenvolvimento do React.
import react from '@vitejs/plugin-react';

// Exporta a configuração usada nos comandos dev, build e preview do frontend.
export default defineConfig({
  // Ativa a transformação dos componentes React.
  plugins: [react()],
  // Faz o Vite carregar o .env localizado na raiz do monorepo, dois níveis acima de apps/web.
  envDir: '../../',
  // Configura o servidor utilizado somente durante o desenvolvimento local.
  server: {
    // Encaminha chamadas REST locais para a API sem exigir URL absoluta nos componentes.
    proxy: {
      // Envia toda requisição iniciada por /api ao Fastify executado na porta 3000.
      '/api': 'http://localhost:3000',
    },
  },
});
