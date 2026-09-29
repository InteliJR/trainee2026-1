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
    // Escuta na rede local para testar pelo celular (http://<IP-do-computador>:5173).
    host: '0.0.0.0',
    // Encaminha chamadas REST locais para a API sem exigir URL absoluta nos componentes.
    proxy: {
      // Envia toda requisição iniciada por /api ao Fastify executado na porta 3000.
      // 127.0.0.1 em vez de localhost: no Windows, localhost pode resolver para ::1 e o Fastify escuta em IPv4.
      '/api': 'http://127.0.0.1:3000',
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
      },
    },
  },
});
