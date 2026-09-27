"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a stable function that calls `callback` only after `delayMs` of
 * silence — for autosave fields where every keystroke would otherwise fire
 * its own request. The latest arguments win; anything queued behind an
 * earlier call within the window is dropped rather than sent.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number
): (...args: A) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (...args: A) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
  };
}
