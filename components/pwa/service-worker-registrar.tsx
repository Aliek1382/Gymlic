"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes the panel installable as
 * a real app on Android — Chrome only offers a WebAPK install once a worker
 * with a fetch handler is controlling the page.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // In dev the worker would sit in front of HMR and serve stale chunks.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Registration failing costs installability, not the panel — so it is
        // logged rather than surfaced to the user.
        console.error("[pwa] service worker registration failed:", error);
      });
    };

    // Waiting for load keeps the worker's install, which fetches the offline
    // page, from competing with the page's own requests for bandwidth.
    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
