"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { bo, boFetch } from "./backoffice";
import { useMenu } from "./menu";
import { fetchShiftOrders, orderKeys } from "./orders";

// The header and back-office tabs navigate with router.push, which (unlike <Link>) never prefetches,
// so each tab's first tap used to wait for its page, then its data, then its photos.
// Once signed in, warm all three in the background so every first tap is as fast as the second.

const DATA_DELAY_MS = 1500; // let the current screen's own requests go first
const REWARM_MS = 5 * 60_000; // re-prefetch a page at most this often

// Keep strong references so the browser doesn't drop the preloads before they're cached
const preloaded = new Map<string, HTMLImageElement>();

export function useWarmup(routes: string[], isOwner: boolean) {
  const router = useRouter();
  const qc = useQueryClient();
  const menu = useMenu();

  // 1. Page code + payload for every tab. When Next drops a prefetched entry (onInvalidate), warm it
  // again — but at most once per REWARM_MS per route, so an eagerly-expiring cache can't turn this
  // into a request loop against the Worker.
  useEffect(() => {
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const last = new Map<string, number>();
    // The typings require `kind`, but its enum isn't exported; at runtime it defaults to "auto"
    // (app-router-instance: options?.kind ?? PrefetchKind.AUTO), which is what <Link> uses.
    type Opts = Parameters<typeof router.prefetch>[1];
    const warm = (href: string) => {
      if (cancelled) return;
      last.set(href, Date.now());
      router.prefetch(href, { onInvalidate: () => later(href) } as Opts);
    };
    const later = (href: string) => {
      const wait = Math.max(0, (last.get(href) ?? 0) + REWARM_MS - Date.now());
      const t = setTimeout(() => {
        timers.delete(t);
        warm(href);
      }, wait);
      timers.add(t);
    };
    routes.forEach(warm);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when the set of routes changes, not the array identity
  }, [router, routes.join()]);

  // 2. Data each tab opens with (same keys + fetchers as the screens' own hooks)
  useEffect(() => {
    const t = setTimeout(() => {
      qc.prefetchQuery({ queryKey: orderKeys.shift, queryFn: fetchShiftOrders });
      if (!isOwner) return;
      qc.prefetchQuery({ queryKey: bo.categories, queryFn: boFetch.categories });
      qc.prefetchQuery({ queryKey: bo.products, queryFn: boFetch.products });
      qc.prefetchQuery({ queryKey: bo.groups, queryFn: boFetch.groups });
      qc.prefetchQuery({ queryKey: bo.ingredients, queryFn: boFetch.ingredients });
      qc.prefetchQuery({ queryKey: bo.staff, queryFn: boFetch.staff });
    }, DATA_DELAY_MS);
    return () => clearTimeout(t);
  }, [qc, isOwner]);

  // 3. Every product photo, so switching category shows them at once instead of popping in
  useEffect(() => {
    for (const c of menu.data ?? []) {
      for (const p of c.products) {
        if (!p.image_url || preloaded.has(p.image_url)) continue;
        const img = new Image();
        img.decoding = "async";
        img.src = p.image_url;
        preloaded.set(p.image_url, img);
      }
    }
  }, [menu.data]);
}
