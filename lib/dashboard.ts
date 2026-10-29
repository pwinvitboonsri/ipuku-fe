"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Back office → Dashboard. GET /report/dashboard returns per-day sums for the range and the one it's compared
// with; everything shown is added up here. Days are Thailand calendar days (UTC+7). Money in satang.

export type DashDay = {
  date: string;
  orders: number;
  walk_orders: number;
  grab_orders: number;
  walk_sales_satang: number;
  grab_sales_satang: number;
  gross_satang: number;
  discount_satang: number;
  refunds: number;
  refund_satang: number;
  voids: number;
  void_satang: number;
  net_satang: number;
  items: number;
  cash_satang: number;
  promptpay_satang: number;
  grab_pay_satang: number;
  claimed: number;
  member_sales_satang: number;
  new_members: number;
  new_friends: number;
  unfollows: number;
  points_issued: number;
  points_redeemed: number;
  stamps_issued: number;
  stamps_redeemed: number;
  waste_entries: number;
  grab_rejected: number;
};
export type DashSum = Omit<DashDay, "date">;

export type DashMember = {
  id: string;
  member_no: number;
  display_name: string | null;
  picture_url: string | null;
  joined_at: string;
  visits: number;
  visits_30d: number;
  spend_satang: number;
  first_visit: string | null;
  last_visit: string | null;
  points: number;
  stamps: number;
  birth_day: number | null;
  birth_month: number | null;
  birthday_coupon: "USED" | "OPEN" | "EXPIRED" | null;
};

// staff_name null: voided by the schedule when a shift closed by itself
export type DashEvent = { kind: "VOID" | "REFUND"; order_id: string | null; order_number: number | null; amount_satang: number; staff_name: string | null; at: string; reason: string | null };

export type Dashboard = {
  /// client side: the range these numbers are for (kept while the next range loads)
  view: Range;
  range: { from: string; to: string; prev_from: string; prev_to: string; prev_until: string };
  now: string;
  /// Thailand dates the shop was closed (weekly day off or special day), both ranges
  closed_days: string[];
  program: { points_per_unit: number; unit_satang: number };
  loyalty_since: string | null;
  days: DashDay[];
  hours: { date: string; hour: number; orders: number; net_satang: number }[];
  products: { product_id: string; name: string; image_url: string | null; category_id: string; category_name: string; quantity: number; revenue_satang: number; prev_quantity: number; prev_revenue_satang: number }[];
  product_series: { product_id: string; date: string; hour: number | null; quantity: number }[];
  options: { modifier_option_id: string; name: string; group_name: string; price_delta_satang: number; picked: number; base: number; revenue_satang: number }[];
  staff: { staff_id: string; name: string; role: "OWNER" | "STAFF"; paid_orders: number; net_sales_satang: number; voids: number; refunds: number }[];
  events: DashEvent[];
  shifts: { id: string; open_at: string; close_at: string; variance_satang: number | null; close_by_staff: { name: string } | null; auto_closed?: boolean }[];
  waste: { ingredient_id: string; name: string; unit: string; entries: number; quantity: number }[];
  rewards: { reward_id: string; name: string; type: string; cost_points: number; cost_currency: "POINTS" | "STAMPS"; image_url: string | null; redemptions: number; discount_satang: number }[];
  reward_discount_satang: number;
  coupon_discount_satang: number;
  coupons: { source: "WELCOME" | "BIRTHDAY" | "MANUAL"; issued: number; used: number; expired: number; open: number }[];
  earn_lines: { label: string; points: number; stamps: number; receipts: number }[];
  earn_rules: { name: string; kind: string; is_active: boolean; weekdays: number[]; time_from: number | null; time_to: number | null }[];
  friends: number;
  prev_friends: number;
  members_total: number;
  prev_members_total: number;
  points_outstanding: number;
  stamps_outstanding: number;
  members: DashMember[];
  cohorts: { month: string; members: number; retention: (number | null)[] }[];
};

// ── Thailand dates ─────────────────────────────────────────────────
const BKK_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
export const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const DOW_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DOW_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const bkkDay = (at: Date | string) => new Date(new Date(at).getTime() + BKK_MS).toISOString().slice(0, 10);
const utcOf = (day: string) => Date.parse(`${day}T00:00:00Z`);
export const addDays = (day: string, n: number) => new Date(utcOf(day) + n * DAY_MS).toISOString().slice(0, 10);
export const dayDiff = (a: string, b: string) => Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
/// 0 = Sunday
export const dow = (day: string) => new Date(utcOf(day)).getUTCDay();
export const dayNum = (day: string) => Number(day.slice(8, 10));
export const monthIdx = (day: string) => Number(day.slice(5, 7)) - 1;
export const thDate = (day: string) => `${dayNum(day)} ${TH_MON[monthIdx(day)]}`;
export function thRange(a: string, b: string) {
  if (a === b) return thDate(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${dayNum(a)}–${dayNum(b)} ${TH_MON[monthIdx(a)]}`;
  return `${thDate(a)} – ${thDate(b)}`;
}
export const hhmm = (at: Date | string) => new Date(new Date(at).getTime() + BKK_MS).toISOString().slice(11, 16);

// ── formatting (whole baht) ────────────────────────────────────────
export const thb = (satang: number) => (satang < -50 ? "−" : "") + "฿" + Math.abs(Math.round(satang / 100)).toLocaleString("en-US");
export const nfmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (n: number, d = 0) => (Number.isFinite(n) ? (n * 100).toFixed(d) : "0") + "%";
export const sdiv = (a: number, b: number) => (b ? a / b : 0);

// ── ranges ─────────────────────────────────────────────────────────
export type RangeKey = "today" | "7d" | "30d" | "month" | "custom";
export const MAX_RANGE_DAYS = 366;

export type Range = {
  key: RangeKey;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /// today so far: compare with yesterday up to the same time
  prevUntil?: string;
  len: number;
  label: string;
  prevLabel: string;
};

export function resolveRange(key: RangeKey, custom: { from: string; to: string }, now: Date): Range {
  const today = bkkDay(now);
  let from = today;
  let to = today;
  if (key === "7d") from = addDays(today, -6);
  else if (key === "30d") from = addDays(today, -29);
  else if (key === "month") from = today.slice(0, 8) + "01";
  else if (key === "custom") ({ from, to } = custom);
  const len = dayDiff(from, to) + 1;
  let prevFrom = addDays(from, -len);
  let prevTo = addDays(from, -1);
  if (key === "month") {
    // the same days of last month, cut at its last day
    prevFrom = addDays(from, -1).slice(0, 8) + "01";
    const end = addDays(from, -1);
    prevTo = addDays(prevFrom, len - 1) > end ? end : addDays(prevFrom, len - 1);
  }
  const clock = hhmm(now);
  return {
    key,
    from,
    to,
    prevFrom,
    prevTo,
    prevUntil: key === "today" ? new Date(now.getTime() - DAY_MS).toISOString() : undefined,
    len,
    label: key === "today" ? `Today · ${thDate(from)} to ${clock}` : thRange(from, to),
    prevLabel: key === "today" ? `yesterday to ${clock}` : thRange(prevFrom, prevTo),
  };
}

export const dashKey = (r: Range) => ["report", "dashboard", r.from, r.to, r.prevFrom, r.prevTo, r.key === "today"] as const;

export function useDashboard(r: Range) {
  return useQuery({
    queryKey: dashKey(r),
    queryFn: () =>
      api
        .get<Omit<Dashboard, "view">>("/report/dashboard", { from: r.from, to: r.to, prev_from: r.prevFrom, prev_to: r.prevTo, prev_until: r.prevUntil })
        .then((d): Dashboard => ({ ...d, view: r })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

// ── sums ───────────────────────────────────────────────────────────
const SUM_KEYS = [
  "orders", "walk_orders", "grab_orders", "walk_sales_satang", "grab_sales_satang", "gross_satang", "discount_satang", "refunds", "refund_satang",
  "voids", "void_satang", "net_satang", "items", "cash_satang", "promptpay_satang", "grab_pay_satang", "claimed", "member_sales_satang",
  "new_members", "new_friends", "unfollows", "points_issued", "points_redeemed", "stamps_issued", "stamps_redeemed", "waste_entries", "grab_rejected",
] as const satisfies readonly (keyof DashSum)[];

export function sumDays(days: DashDay[], from: string, to: string): DashSum {
  const s = Object.fromEntries(SUM_KEYS.map((k) => [k, 0])) as DashSum;
  for (const d of days) if (d.date >= from && d.date <= to) for (const k of SUM_KEYS) s[k] += d[k];
  return s;
}

export const sales = (s: DashSum) => s.walk_sales_satang + s.grab_sales_satang;
export const memberShare = (s: DashSum) => sdiv(s.member_sales_satang, sales(s));
export const claimRate = (s: DashSum) => sdiv(s.claimed, s.walk_orders);
export const avgTicket = (s: DashSum) => sdiv(s.net_satang, s.orders);

// ── chart series ───────────────────────────────────────────────────
// closed: the shop was closed that day (shown as such, not as a zero day)
export type Point = { label: string; full: string; v: number; p: number | null; weekend?: boolean; future?: boolean; closed?: boolean };
export type Metric = "net" | "orders" | "avg" | "claim" | "new_members" | "waste";

const dayValue = (d: DashDay | undefined, m: Metric) => {
  if (!d) return 0;
  if (m === "net") return d.net_satang;
  if (m === "orders") return d.orders;
  if (m === "avg") return sdiv(d.net_satang, d.orders);
  if (m === "claim") return sdiv(d.claimed, d.walk_orders);
  if (m === "new_members") return d.new_members;
  return d.waste_entries;
};

/// Opening hours seen in the data (at least 07–20), for hour-by-hour views
export function hourSpan(D: Dashboard): number[] {
  const seen = D.hours.map((h) => h.hour);
  const lo = Math.min(7, ...seen);
  const hi = Math.max(20, ...seen);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/// One bar per day of the range (per hour when it's one day), with the matching day/hour of the previous range
export function series(D: Dashboard, r: Range, m: Metric, now: Date): Point[] {
  if (r.from === r.to && (m === "net" || m === "orders" || m === "avg")) {
    const nowHour = r.key === "today" ? Number(hhmm(now).slice(0, 2)) : 24;
    const at = (date: string, h: number) => D.hours.find((x) => x.date === date && x.hour === h);
    const val = (x: { orders: number; net_satang: number } | undefined) => (!x ? 0 : m === "net" ? x.net_satang : m === "orders" ? x.orders : sdiv(x.net_satang, x.orders));
    return hourSpan(D).map((h) => ({
      label: String(h),
      full: `${String(h).padStart(2, "0")}:00`,
      future: h > nowHour,
      v: h > nowHour ? 0 : val(at(r.from, h)),
      p: val(at(r.prevFrom, h)),
    }));
  }
  const byDate = new Map(D.days.map((d) => [d.date, d]));
  const closed = new Set(D.closed_days ?? []);
  const out: Point[] = [];
  for (let i = 0; i < r.len; i++) {
    const date = addDays(r.from, i);
    const pd = addDays(r.prevFrom, i);
    const w = dow(date);
    // a closed day with no sales is "Closed", not a zero; one with sales (opened anyway) shows its numbers
    const isClosed = closed.has(date) && !byDate.get(date)?.orders;
    out.push({ label: String(dayNum(date)), full: `${DOW_SUN[w]} ${thDate(date)}`, v: dayValue(byDate.get(date), m), p: pd <= r.prevTo ? dayValue(byDate.get(pd), m) : null, weekend: w === 0 || w === 6, closed: isClosed });
  }
  return out;
}

/// New members per day for short ranges, per Monday-started week otherwise
export function newMemberSeries(D: Dashboard, r: Range, now: Date): Point[] {
  if (r.len <= 14) return series(D, r, "new_members", now);
  const out: Point[] = [];
  let d = r.from;
  while (d <= r.to) {
    const toSun = (7 - dow(d)) % 7;
    const end = addDays(d, toSun) > r.to ? r.to : addDays(d, toSun);
    out.push({ label: thDate(d), full: `Week of ${thRange(d, end)}`, v: sumDays(D.days, d, end).new_members, p: null });
    d = addDays(end, 1);
  }
  return out;
}

/// Orders by weekday (Mon first) × hour over the range
export function heatGrid(D: Dashboard, r: Range): { hours: number[]; grid: number[][] } {
  const hours = hourSpan(D);
  const grid = DOW_MON.map(() => hours.map(() => 0));
  for (const h of D.hours) {
    if (h.date < r.from || h.date > r.to) continue;
    const j = hours.indexOf(h.hour);
    if (j >= 0) grid[(dow(h.date) + 6) % 7][j] += h.orders;
  }
  return { hours, grid };
}

// ── members ────────────────────────────────────────────────────────
export const memberName = (m: DashMember) => m.display_name || "LINE member";
export const memberNo = (m: DashMember) => `IPK-${String(m.member_no).padStart(6, "0")}`;
/// days since the last paid visit (or since joining, if they never came back)
export const daysAway = (m: DashMember, now: Date) => dayDiff(bkkDay(m.last_visit ?? m.joined_at), bkkDay(now));

export type SegKey = "new" | "regular" | "atRisk" | "lapsed";
export const SEG_META: Record<SegKey, { label: string; sub: string; tone: string }> = {
  new: { label: "New", sub: "Joined in range", tone: "var(--matcha)" },
  regular: { label: "Regular", sub: "4+ visits in 30 days", tone: "var(--ink-2)" },
  atRisk: { label: "At risk", sub: "No visit 30–60 days", tone: "var(--yuzu)" },
  lapsed: { label: "Lapsed", sub: "No visit 60+ days", tone: "var(--persimmon)" },
};

export function segments(D: Dashboard, r: Range, now: Date): Record<SegKey, DashMember[]> {
  const ms = D.members;
  return {
    new: ms.filter((m) => bkkDay(m.joined_at) >= r.from && bkkDay(m.joined_at) <= r.to),
    regular: ms.filter((m) => m.visits_30d >= 4),
    atRisk: ms.filter((m) => daysAway(m, now) >= 30 && daysAway(m, now) < 60),
    lapsed: ms.filter((m) => daysAway(m, now) >= 60),
  };
}

export const loyaltyAge = (D: Dashboard, now: Date) => (D.loyalty_since ? dayDiff(bkkDay(D.loyalty_since), bkkDay(now)) + 1 : 0);
