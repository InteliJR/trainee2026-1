import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  /** `alertdialog` para decisões curtas; `dialog` quando há formulário dentro. */
  role?: 'dialog' | 'alertdialog';
  /** Trava Esc e o clique no backdrop enquanto uma ação está em andamento. */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}

// <dialog> nativo: foco preso, Esc e backdrop já tratados pelo navegador.
// O elemento com `data-autofocus` recebe o foco inicial — use a opção segura.
export function Dialog({ open, title, role = 'dialog', busy, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // Esc: quem manda no estado é o pai
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose(); // clique no backdrop
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg bg-neutral-0 p-0 shadow-card backdrop:bg-neutral-900/60"
    >
      {open && (
        <div className="max-h-[85vh] space-y-4 overflow-y-auto p-5">
          <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
