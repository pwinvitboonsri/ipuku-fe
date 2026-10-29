"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Back office → Opening hours (GET /shop-hours) and today's plan for the counter (GET /shop-hours/today).
// Minutes are after midnight, dates are Thailand dates (YYYY-MM-DD).

export type DayHours = { open: boolean; open_min: number; close_min: number };
export type WeeklyRow = { id: string; effective_from: string; days: DayHours[]; in_force: boolean; upcoming: boolean };
export type SpecialKind = "CLOSED" | "HOURS";
export type SpecialDay = { id: string; kind: SpecialKind; from_date: string; to_date: string; open_min: number | null; close_min: number | null; note: string | null; create_at: string };
export type DayPlan = {
  date: string;
  open: boolean;
  reason?: "WEEKLY" | "SPECIAL" | "NO_HOURS";
  open_min?: number;
  close_min?: number;
  open_at?: string;
  close_at?: string;
  special_id: string | null;
  note: string | null;
  orders?: number;
  past?: boolean;
};
export type ShopSettings = { auto_shift: boolean; auto_close_grace_minutes: number; default_float_satang: number };
export type ShopHours = { today: string; settings: ShopSettings; weekly: WeeklyRow[]; specials: SpecialDay[]; days: DayPlan[] };
export type TodayPlan = { auto_shift: boolean; grace_minutes: number; default_float_satang: number; plan: DayPlan };
export type SpecialSaved = { special: SpecialDay; removed: number; kept_days_with_sales: string[] };

export const shopHoursKey = ["shop-hours"] as const;
export const todayPlanKey = ["shop-hours", "today"] as const;

export const useShopHours = () => useQuery({ queryKey: shopHoursKey, queryFn: () => api.get<ShopHours>("/shop-hours") });
export const useTodayPlan = (enabled = true) => useQuery({ queryKey: todayPlanKey, queryFn: () => api.get<TodayPlan>("/shop-hours/today"), staleTime: 60_000, enabled });

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const hhmm = (min: number | null | undefined) => (min == null ? "—" : `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayLabel = (date: string) => `${DAY_SHORT[weekdayOf(date)]} ${Number(date.slice(8))} ${MON[Number(date.slice(5, 7)) - 1]}`;
export const rangeLabel = (a: string, b: string) => (a === b ? dayLabel(a) : `${dayLabel(a)} – ${dayLabel(b)}`);

/// "10:00–18:00", "Closed", "Closed · Vacation"
export function planText(p: DayPlan) {
  if (!p.open) return p.reason === "NO_HOURS" ? "No hours set" : `Closed${p.note ? ` · ${p.note}` : ""}`;
  return `${hhmm(p.open_min)}–${hhmm(p.close_min)}${p.note ? ` · ${p.note}` : ""}`;
}

/// the hours the editor starts from when no week is saved yet: 10:00–18:00, Saturday off
export const DEFAULT_WEEK: DayHours[] = Array.from({ length: 7 }, (_, i) => ({ open: i !== 6, open_min: 600, close_min: 1080 }));
