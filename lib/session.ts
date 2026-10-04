"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { api, request } from "./api";
import { connectivity } from "./connectivity";
import type { CashSession, SessionStaff, Staff } from "./types";

export const qk = {
  session: ["session"] as const,
  currentShift: ["cash-session", "current"] as const,
  health: ["health"] as const,
  openOrders: ["order", "OPEN"] as const,
};

export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: async () => (await request<{ staff: SessionStaff }>("/api/session")).data.staff,
    staleTime: Infinity,
  });
}

// GET /auth → { user: [{ id, name }], total } — active staff, device-signed by the BFF.
// Also used to turn staff ids on sessions/orders into names.
export function useStaffList() {
  return useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => (await api.get<{ user: Staff[]; total: number }>("/auth")).user ?? [],
    staleTime: 5 * 60_000,
  });
}

export function useStaffName() {
  const { data } = useStaffList();
  return useCallback((id?: string | null) => (id ? data?.find((s) => s.id === id)?.name : undefined), [data]);
}

export function useCurrentShift(enabled = true) {
  return useQuery({
    queryKey: qk.currentShift,
    queryFn: () => api.get<CashSession | null>("/cash-session/current"),
    enabled,
  });
}

const HEALTH_RETRY_MS = 10_000;

// Server reachability for the offline banner. No polling while online — requests themselves
// report failures (lib/connectivity). Only while offline is /health checked, every 10 s, until it answers.
export function useOnline() {
  const online = useSyncExternalStore(connectivity.subscribe, connectivity.get, () => true);
  useQuery({
    queryKey: qk.health,
    queryFn: async () => (await request<unknown>("/api/health")).data, // success marks us online
    enabled: !online,
    refetchInterval: HEALTH_RETRY_MS,
    refetchIntervalInBackground: true,
    retry: false,
    gcTime: 0,
  });
  return online;
}

export function useSignOut() {
  const qc = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    try {
      await request("/api/session/logout", { method: "POST" });
    } finally {
      qc.clear();
      router.replace("/login");
    }
  }, [qc, router]);
}

// Current time, re-read every 15 s; null during SSR so server and client markup match.
const subscribeClock = (cb: () => void) => {
  const t = setInterval(cb, 15_000);
  return () => clearInterval(t);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);
export function useNow(): Date | null {
  const m = useSyncExternalStore(subscribeClock, minuteNow, () => 0);
  return m ? new Date(m * 60_000) : null;
}
