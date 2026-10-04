"use client";

import { useSyncExternalStore } from "react";

// Reactive CSS media query. Server render assumes `serverDefault` (the wide tablet layout).
export function useMediaQuery(query: string, serverDefault = false) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}

// Side-by-side layouts (menu | order panel, payment | order) on any landscape screen 700px+ wide
// (tablets, desktops, landscape phones — which are too short for a bottom drawer).
// Portrait tablets and phones get stacked layouts with a bottom drawer.
export const WIDE_QUERY = "(min-width: 700px) and (orientation: landscape)";
export const useWideLayout = () => useMediaQuery(WIDE_QUERY, true);

// Two-pane list/detail (Orders, back office) from tablet portrait width upwards.
export const useTwoPane = () => useMediaQuery("(min-width: 768px)", true);
