'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PanelProps = {
  title: string;
  titleId?: string;
  children: ReactNode;
  /** Bottom-right. Ghost cancel first, the real action last. */
  actions?: ReactNode;
  className?: string;
};

/** The visible box. Exported so the dev page can show it at rest, outside a dialog. */
export function ModalPanel({ title, titleId, children, actions, className }: PanelProps) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-modal border border-line-strong bg-ink-800 text-fg shadow-modal',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 px-6 pt-6">
        <h2 id={titleId} className="font-display text-[22px] font-medium">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-fg-2">{children}</div>
      </div>
      {actions && <div className="flex justify-end gap-2.5 px-6 pb-6 pt-5">{actions}</div>}
    </div>
  );
}

type ModalProps = Omit<PanelProps, 'titleId'> & {
  open: boolean;
  onClose: () => void;
};

/**
 * Native <dialog>: focus trap, Escape, and return-focus-to-trigger come from the
 * platform. The scrim is dialog::backdrop, styled in globals.css.
 */
export function Modal({ open, onClose, title, children, actions, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Only the backdrop is the dialog element itself; clicks inside land on the panel.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[480px] bg-transparent p-0"
    >
      <ModalPanel title={title} titleId={titleId} actions={actions} className={className}>
        {children}
      </ModalPanel>
    </dialog>
  );
}
