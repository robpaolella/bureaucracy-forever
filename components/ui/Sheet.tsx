'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type SheetProps = {
  /** Lets the trigger point at the sheet with aria-controls. */
  id?: string;
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Bottom row, typically one primary "Done" or "Apply". A ghost close is always present. */
  actions?: ReactNode;
  className?: string;
};

/**
 * A bottom sheet for phones: the Modal's surface and scrim, anchored to the bottom edge
 * with the top corners rounded, scrolling inside past 80% of the viewport. Native
 * <dialog>, so focus trap, Escape and focus return come from the platform. On wide
 * screens it centres like a modal, so nothing breaks if it opens there.
 */
export function Sheet({ id, open, onClose, title, children, actions, className }: SheetProps) {
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
      id={id}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 sm:m-auto sm:w-[calc(100%-32px)] sm:max-w-[480px]"
    >
      <div className={cn('flex max-h-[80vh] flex-col rounded-t-modal border border-line-strong bg-ink-800 text-fg shadow-modal sm:rounded-modal', className)}>
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          <h2 id={titleId} className="font-display text-[22px] font-medium">
            {title}
          </h2>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </Button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">{children}</div>
        {actions && <div className="flex justify-end gap-2.5 border-t border-line px-5 py-4">{actions}</div>}
      </div>
    </dialog>
  );
}
