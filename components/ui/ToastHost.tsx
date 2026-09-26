'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Toast, type ToastData } from './Toast';

const ToastContext = createContext<((toast: ToastData) => void) | null>(null);

/**
 * One toast for a whole view. Several client islands (a composer, an action bar) share it
 * so only one `role="status"` region exists at a time and the latest message wins.
 */
export function ToastHost({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const show = useCallback((next: ToastData) => setToast(next), []);
  const dismiss = useCallback(() => setToast(null), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <Toast toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** The shared toast's `show`. Throws outside a ToastHost so a missing provider is caught in development. */
export function useToast(): (toast: ToastData) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast needs a ToastHost above it');
  return show;
}
