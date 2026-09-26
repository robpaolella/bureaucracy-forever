'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Drag-painting shared by the week grid and the mobile day column. A stroke starts on
 * `pointerdown` over a cell, continues over whichever cell is under the pointer (found
 * with `elementFromPoint`, since touch pointers stay captured to the first element), and
 * ends on a window-level `pointerup`, which a listener on the grid alone would miss when
 * the pointer leaves it mid-drag (docs/05 § Painting).
 */
export function usePaintStroke(paintCell: (key: string) => void) {
  const painting = useRef(false);

  useEffect(() => {
    const end = () => {
      painting.current = false;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  const keyAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    return (el?.closest('[data-key]') as HTMLElement | null)?.dataset.key ?? null;
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key;
      if (!key || e.button !== 0) return;
      e.preventDefault();
      painting.current = true;
      paintCell(key);
    },
    [paintCell],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!painting.current) return;
      const key = keyAt(e.clientX, e.clientY);
      if (key) paintCell(key);
    },
    [paintCell],
  );

  return { onPointerDown, onPointerMove, painting };
}
