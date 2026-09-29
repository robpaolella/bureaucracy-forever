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

/**
 * The visible box. Title and actions stay put; only the body scrolls, so the frame is
 * always whole however tall the content. Exported so the dev page can show it at rest.
 */
export function ModalPanel({ title, titleId, children, actions, className }: PanelProps) {
  return (
    <div
      className={cn(
        'flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-modal border border-line-strong bg-ink-800 text-fg shadow-modal',
        className,
      )}
    >
      <h2 id={titleId} className="shrink-0 px-6 pb-1.5 pt-6 font-display text-[22px] font-medium">
        {title}
      </h2>
      {/* pt-1 leaves room for a focus ring on the first control. */}
      <div className={cn('min-h-0 overflow-y-auto overscroll-contain px-6 pt-1 text-sm leading-relaxed text-fg-2', !actions && 'pb-6')}>{children}</div>
      {actions && <div className="flex shrink-0 justify-end gap-2.5 px-6 pb-6 pt-5">{actions}</div>}
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
      className="m-auto max-h-none w-[calc(100%-32px)] max-w-[480px] overflow-visible bg-transparent p-0"
    >
      <ModalPanel title={title} titleId={titleId} actions={actions} className={className}>
        {children}
      </ModalPanel>
    </dialog>
  );
}
