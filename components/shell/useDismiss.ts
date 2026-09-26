'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Disclosure state for a popover: open/close, Escape, outside pointer-down, focus
 * leaving the container (tabbing past the last item), and focus return. If focus was inside the popover when it closed (Escape from a menu
 * link), it goes back to the trigger; an outside click keeps its own focus target.
 */
export function useDisclosure(containerRef: RefObject<HTMLElement | null>, triggerRef: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const restoreFocus = useRef(false);

  const close = useCallback(() => {
    restoreFocus.current = Boolean(containerRef.current?.contains(document.activeElement));
    setOpen(false);
  }, [containerRef]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    triggerRef.current?.focus();
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        restoreFocus.current = false;
        setOpen(false);
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && containerRef.current && !containerRef.current.contains(next)) {
        restoreFocus.current = false;
        setOpen(false);
      }
    };
    const container = containerRef.current;
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    container?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      container?.removeEventListener('focusout', onFocusOut);
    };
  }, [open, close, containerRef]);

  return { open, close, toggle };
}
