// Tokens do guia de estilos (documents/William/guia-de-estilos.md).
// Ajustes de contraste (AA) em relação aos valores-base do guia:
//  - brand: a base #238e58 fica em 500; botões usam 600 (texto branco ≥ 4.5:1).
//  - operational: anel de foco usa 600 (≥ 3:1 sobre branco); 500 fica para fundos/mapas.

export const colors = {
  brand: {
    50: '#eefaf3',
    100: '#d6f2e1',
    200: '#b0e4c8',
    500: '#238e58',
    600: '#1c7a4b',
    700: '#17633c',
    800: '#154f32',
  },
  operational: {
    50: '#ecfeff',
    100: '#cffafe',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
  },
  reward: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    800: '#92400e',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
  },
  neutral: {
    0: '#ffffff',
    50: '#f6f8f7',
    100: '#eaefec',
    200: '#d5ddd9',
    300: '#b8c4be',
    400: '#8a9a92',
    500: '#66766e',
    600: '#4a5952',
    700: '#33403a',
    800: '#1f2b25',
    900: '#142019',
  },
  // Cores de status: texto/ícone (`status-*`) e fundo suave (`status-*-bg`).
  status: {
    pending: '#92400e',
    'pending-bg': '#fef3c7',
    assigned: '#0e7490',
    'assigned-bg': '#cffafe',
    'in-service': '#5b21b6',
    'in-service-bg': '#ede9fe',
    completed: '#17633c',
    'completed-bg': '#d6f2e1',
    cancelled: '#4a5952',
    'cancelled-bg': '#eaefec',
  },
} as const;

export const spacing = {
  screen: '1rem',
  section: '1.5rem',
} as const;

export const maxWidth = {
  app: '28rem',
  dashboard: '90rem',
} as const;

export const minHeight = {
  touch: '2.75rem',
  'touch-lg': '3.5rem',
} as const;

export const minWidth = {
  touch: '2.75rem',
} as const;

export const boxShadow = {
  card: '0 1px 2px rgba(20, 32, 25, 0.06), 0 1px 3px rgba(20, 32, 25, 0.1)',
  kpi: '0 2px 6px rgba(20, 32, 25, 0.08)',
  focus: '0 0 0 2px #ffffff, 0 0 0 4px #0891b2',
} as const;
