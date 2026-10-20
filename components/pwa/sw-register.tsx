"use client";

import { useEffect } from "react";

// Registers /sw.js in production builds. In dev it removes any old registration and its caches,
// so stale cached chunks (dev chunk names don't change with content) never fight with hot reload.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      caches
        ?.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ipk-")).map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not a secure context (plain http on a LAN IP) — the app still works, just not installable.
    });
  }, []);
  return null;
}
