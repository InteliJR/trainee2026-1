import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefaf3',
          100: '#d7f0e2',
          200: '#aee0c6',
          300: '#7acba3',
          600: '#238e58',
          700: '#1d7449',
        },
        operational: {
          100: '#cffafe',
          500: '#06b6d4',
          700: '#0e7490',
          800: '#155e75',
        },
        reward: {
          100: '#fef3c7',
          800: '#92400e',
          900: '#78350f',
        },
        earth: {
          50: '#f7f0e6',
          100: '#eadcc7',
          600: '#78562d',
          700: '#604324',
        },
        danger: {
          50: '#fef2f2',
          200: '#fecaca',
          600: '#ef4444',
          700: '#b91c1c',
          800: '#991b1b',
        },
        neutral: {
          100: '#f4f7f5',
          200: '#dce5df',
          300: '#bdc9c1',
          400: '#8fa097',
          500: '#64756c',
          600: '#46564d',
          700: '#2f3d35',
          800: '#1f2b24',
          900: '#142019',
          950: '#0b120e',
        },
      },
      spacing: {
        screen: '1rem',
        section: '1.5rem',
        touch: '2.75rem',
      },
      minHeight: {
        touch: '2.75rem',
        'touch-lg': '3.5rem',
      },
      maxWidth: {
        app: '28rem',
        dashboard: '90rem',
      },
      boxShadow: {
        card: '0 10px 30px rgb(20 32 25 / 0.08)',
        kpi: '0 14px 38px rgb(6 182 212 / 0.14)',
        focus: '0 0 0 3px rgb(6 182 212 / 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
