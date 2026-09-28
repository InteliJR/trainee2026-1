/** Informa ao Tailwind quais arquivos devem ser analisados para gerar somente as classes CSS utilizadas. */
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
