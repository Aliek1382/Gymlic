"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced autosave for one record's fields. Patches queued inside the
 * window are merged (typing in the amount field and then the note within
 * half a second sends both, not just the last), saves never overlap, and
 * anything still pending is sent when the component unmounts — closing the
 * dialog right after an edit doesn't lose it, which a plain debounce would.
 *
 * `onBusyChange(true)` fires as soon as something is waiting or in flight and
 * `(false)` once everything has been sent; a failed save goes to `onError`
 * and does not stop later ones.
 */
export function useAutosavePatch<T extends object>(
  save: (patch: Partial<T>) => Promise<void>,
  {
    delayMs = 500,
    onBusyChange,
    onError,
  }: {
    delayMs?: number;
    onBusyChange?: (busy: boolean) => void;
    onError?: (error: unknown) => void;
  } = {}
): (patch: Partial<T>) => void {
  const latest = useRef({ save, onBusyChange, onError });
  latest.current = { save, onBusyChange, onError };

  const pending = useRef<Partial<T> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  const flush = useCallback(async () => {
    // A save already in flight picks up whatever is pending when it returns.
    if (running.current) return;
    running.current = true;
    try {
      while (pending.current) {
        const patch = pending.current;
        pending.current = null;
        try {
          await latest.current.save(patch);
        } catch (error) {
          latest.current.onError?.(error);
        }
      }
    } finally {
      running.current = false;
      latest.current.onBusyChange?.(false);
    }
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    },
    [flush]
  );

  return useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...pending.current, ...patch };
      latest.current.onBusyChange?.(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, delayMs);
    },
    [delayMs, flush]
  );
}
