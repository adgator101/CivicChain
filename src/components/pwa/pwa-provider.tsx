"use client";

import { useEffect } from "react";
import { startAutoSync } from "@/lib/offline/sync";

// Mounted once in the root layout. Registers the service worker (offline app
// shell) and starts the outbox auto-sync so queued complaints flush the moment
// connectivity returns. No UI.
export function PwaProvider() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // SW registration failing should never break the app.
        });
    }
    const stop = startAutoSync();
    return stop;
  }, []);

  return null;
}
