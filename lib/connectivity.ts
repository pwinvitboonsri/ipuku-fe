// Tiny connectivity store. The app goes "offline" only when a real request can't reach the
// server (or the browser reports offline); /health is then polled until it answers again.
// While online nothing is polled.

// Header the BFF sets on its own gateway errors, so an intentional 502 from NestJS isn't mistaken for an outage.
export const UNREACHABLE_HEADER = "x-ipk-upstream";

let online = true;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (online === next) return;
  online = next;
  listeners.forEach((l) => l());
}

export const connectivity = {
  markOffline: () => set(false),
  markOnline: () => set(true),
  get: () => online,
  subscribe(cb: () => void) {
    listeners.add(cb);
    const off = () => set(false);
    const on = () => set(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  },
};
