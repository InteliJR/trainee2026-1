import type { Config } from 'tailwindcss';
import { boxShadow, colors, maxWidth, minHeight, minWidth, spacing } from './src/styles/design-tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors,
      spacing,
      maxWidth,
      minHeight,
      minWidth,
      boxShadow,
    },
  },
  plugins: [],
} satisfies Config;
