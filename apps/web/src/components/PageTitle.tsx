import { useEffect, useRef, type ReactNode } from 'react';

// <h1> da tela: recebe o foco ao montar, para leitores de tela anunciarem a mudança de página/passo.
export function PageTitle({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold text-neutral-900">
      {children}
    </h1>
  );
}
