'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type PanelProps = {
  title: string;
  titleId?: string;
  children: ReactNode;
  /** Bottom-right. Ghost cancel first, the real action last. */
  actions?: ReactNode;
  className?: string;
  /** A large window (the reserves picker): ruled head and foot, a close button, a bottom sheet on phones. */
  wide?: boolean;
  /** Above the title, such as a confirmation line. */
  eyebrow?: ReactNode;
  /** Under the title, fixed with it. */
  intro?: ReactNode;
  /** Shows the close button. */
  onClose?: () => void;
};

/**
 * The visible box. Title and actions stay put; only the body scrolls, so the frame is
 * always whole however tall the content. Exported so the dev page can show it at rest.
 */
export function ModalPanel({ title, titleId, children, actions, className, wide = false, eyebrow, intro, onClose }: PanelProps) {
  const heading = (
    <h2 id={titleId} className={cn('font-display text-[22px] font-medium', !wide && 'shrink-0 px-6 pb-1.5 pt-6')}>
      {title}
    </h2>
  );
  return (
    <div
      className={cn(
        // Leaves 16px of scrim above and below.
        'flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-modal border border-line-strong bg-ink-800 text-fg shadow-modal',
        wide && 'max-sm:max-h-[92dvh] max-sm:rounded-b-none',
        className,
      )}
    >
      {wide ? (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-line px-5 pb-3 pt-5">
          {eyebrow}
          <div className="flex items-start justify-between gap-3">
            {heading}
            {onClose && (
              <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} className="-mr-2 -mt-1.5 shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </Button>
            )}
          </div>
          {intro}
        </div>
      ) : (
        heading
      )}
      {/* py-1 leaves room for focus rings on the first and last controls. */}
      <div className={cn('min-h-0 overflow-y-auto overscroll-contain text-sm leading-relaxed text-fg-2', wide ? 'px-5 py-4' : 'px-6 py-1', !actions && !wide && 'pb-6')}>{children}</div>
      {actions && <div className={cn('flex shrink-0 justify-end gap-2.5', wide ? 'flex-wrap items-center border-t border-line px-5 py-3.5' : 'px-6 pb-6 pt-4')}>{actions}</div>}
    </div>
  );
}

type ModalProps = Omit<PanelProps, 'titleId' | 'onClose'> & {
  open: boolean;
  onClose: () => void;
};

/**
 * Native <dialog>: focus trap, Escape, and return-focus-to-trigger come from the
 * platform. The scrim is dialog::backdrop, styled in globals.css.
 */
export function Modal({ open, onClose, title, children, actions, className, wide, eyebrow, intro }: ModalProps) {
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
        // React bubbles a nested dialog's cancel (the picker's Sheet) up here; Escape closes only the innermost layer.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Only the backdrop is the dialog element itself; clicks inside land on the panel.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn('max-h-none overflow-visible bg-transparent p-0', wide ? 'm-0 mt-auto w-full max-w-none sm:m-auto sm:w-[calc(100%-32px)] sm:max-w-[960px]' : 'm-auto w-[calc(100%-32px)] max-w-[480px]')}
    >
      <ModalPanel title={title} titleId={titleId} actions={actions} className={className} wide={wide} eyebrow={eyebrow} intro={intro} onClose={wide ? onClose : undefined}>
        {children}
      </ModalPanel>
    </dialog>
  );
}
