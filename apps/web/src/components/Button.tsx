import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-solid' | 'ghost';

export type ButtonSize = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  // aria-disabled = bloqueado mas focável (o motivo é lido junto): cinza legível, sem depender de opacidade.
  'aria-disabled:cursor-not-allowed aria-disabled:border aria-disabled:border-neutral-400 aria-disabled:bg-neutral-200 ' +
  'aria-disabled:text-neutral-700 aria-disabled:hover:bg-neutral-200';

// `lg` = botão de campo (guia: coletor usa `min-h-touch-lg`, texto maior).
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-touch text-sm',
  lg: 'min-h-touch-lg text-base',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600',
  secondary: 'border border-neutral-500 bg-neutral-0 text-neutral-900 hover:bg-neutral-100',
  danger: 'border border-danger-600 bg-neutral-0 text-danger-700 hover:bg-danger-50',
  'danger-solid': 'bg-danger-600 text-white hover:bg-danger-700',
  ghost: 'text-operational-700 hover:bg-operational-50',
};

/** Classes do botão — também servem para `<Link>` estilizado como botão. */
export const buttonClasses = (variant: ButtonVariant = 'primary', fullWidth = false, size: ButtonSize = 'md'): string =>
  `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  /** Trava cliques e troca o texto (evita envio duplicado). */
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  loading,
  loadingText,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClasses(variant, fullWidth, size)} ${className}`}
    >
      {!loading && icon}
      {loading ? (loadingText ?? children) : children}
    </button>
  );
}
