'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/cn';

export type ToastData = {
  tone: 'ok' | 'stop';
  title: string;
  /** Second line, small / fg-3. */
  detail?: string;
  action?: { label: string; onClick: () => void };
};

/**
 * Bottom-centre notice for 4s (docs/04 § Sign-up confirmation): ink-800, line-strong,
 * radius card, shadow-pop, a tone dot, one line, an optional small second line and an
 * optional link-styled action. Covers availability saves and officer actions too.
 */
export function Toast({ toast, onDismiss, duration = 4000 }: { toast: ToastData | null; onDismiss: () => void; duration?: number }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-6 z-30 mx-auto flex w-fit max-w-full items-center gap-3 rounded-card border border-line-strong bg-ink-800 px-4 py-3 shadow-pop"
    >
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', toast.tone === 'ok' ? 'bg-ok' : 'bg-stop')} />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{toast.title}</span>
        {toast.detail && <span className="text-small text-fg-3">{toast.detail}</span>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="ml-2 flex min-h-11 items-center border-b border-teal-dim text-sm font-semibold text-teal transition-[filter] duration-[120ms] hover:brightness-110"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
