"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 640px)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Tailwind's `sm` breakpoint and up. False on the server and on the first paint, so phones never flash the desktop layout. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
