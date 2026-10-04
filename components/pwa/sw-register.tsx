"use client";

import { useEffect } from "react";

// Registers /sw.js in production builds. In dev it removes any old registration so the
// cache never fights with hot reload.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not a secure context (plain http on a LAN IP) — the app still works, just not installable.
    });
  }, []);
  return null;
}
