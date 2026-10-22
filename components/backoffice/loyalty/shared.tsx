"use client";

import type { ReactNode } from "react";
import { bo, useCategories, useGroups, useProducts } from "@/lib/backoffice";
import { Select } from "../common";

// Back office → Loyalty: query keys and pickers shared by the tabs (earn rules, rewards, later promotions)

export const keys = {
  program: [...bo.loyalty, "program"] as const,
  rewards: [...bo.loyalty, "rewards"] as const,
  earnRules: [...bo.loyalty, "earn-rules"] as const,
  perks: [...bo.loyalty, "perks"] as const,
  members: (q: string) => [...bo.loyalty, "members", q] as const,
  activity: (t: string) => [...bo.loyalty, "activity", t] as const,
};

export const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

// ── chips

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`tap shrink-0 rounded-full border px-3 py-[6px] text-[12.5px] font-semibold ${on ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2"}`}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// ── schedule (Thailand time)

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 0 = Sunday … 6 = Saturday; none chosen = every day
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAYS.map((d, i) => (
        <Chip key={d} on={value.includes(i)} onClick={() => onChange(toggle(value, i).sort())}>
          {d}
        </Chip>
      ))}
      {value.length === 0 && <span className="self-center text-[12px] text-muted">every day</span>}
    </div>
  );
}

export const minutesToTime = (m: number | null) => (m == null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
export const timeToMinutes = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);

const inputCls = "h-10 rounded-[10px] border border-line-2 bg-card px-3 text-[14px] text-ink";

export function TimeRange({ from, to, onChange }: { from: number | null; to: number | null; onChange: (from: number | null, to: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <input type="time" className={inputCls} value={minutesToTime(from)} onChange={(e) => onChange(timeToMinutes(e.target.value), to)} />
      <span className="text-muted">to</span>
      <input type="time" className={inputCls} value={minutesToTime(to)} onChange={(e) => onChange(from, timeToMinutes(e.target.value))} />
      {(from != null || to != null) && (
        <button type="button" className="tap text-[12px] font-semibold text-ink-2 underline" onClick={() => onChange(null, null)}>
          all day
        </button>
      )}
    </div>
  );
}

// Dates are whole days in Thailand: start at 00:00, end after 23:59 of the end date
export const isoToDate = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10) : "");
export const dateToStartIso = (d: string) => (d ? `${d}T00:00:00+07:00` : null);
export const dateToEndIso = (d: string) => (d ? `${d}T23:59:59+07:00` : null);

export function DateRange({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <input type="date" className={inputCls} value={start} onChange={(e) => onChange(e.target.value, end)} />
      <span className="text-muted">to</span>
      <input type="date" className={inputCls} value={end} min={start || undefined} onChange={(e) => onChange(start, e.target.value)} />
      {!start && !end && <span className="text-[12px] text-muted">no end date</span>}
    </div>
  );
}

// ── what a rule/reward applies to: categories and/or products (none = everything)

export function TargetPicker({
  productIds,
  categoryIds,
  onChange,
  emptyText = "every item",
}: {
  productIds: string[];
  categoryIds: string[];
  onChange: (productIds: string[], categoryIds: string[]) => void;
  emptyText?: string;
}) {
  const categories = useCategories();
  const products = useProducts();
  const productName = new Map((products.data ?? []).map((p) => [p.id, p.name]));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} on={categoryIds.includes(c.id)} onClick={() => onChange(productIds, toggle(categoryIds, c.id))}>
            {c.name}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {productIds.map((id) => (
          <Chip
            key={id}
            on
            onClick={() =>
              onChange(
                productIds.filter((x) => x !== id),
                categoryIds,
              )
            }
          >
            {productName.get(id) ?? "…"} ×
          </Chip>
        ))}
        <div className="min-w-[180px] flex-1">
          <Select value="" onChange={(id) => id && onChange([...productIds, id], categoryIds)}>
            <option value="">+ Add a product…</option>
            {(products.data ?? [])
              .filter((p) => p.is_active && !productIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>
      </div>
      {productIds.length === 0 && categoryIds.length === 0 && <span className="text-[12px] text-muted">Nothing chosen = {emptyText}.</span>}
    </div>
  );
}

// Modifier options (size-up, oat milk…), grouped
export function OptionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const groups = useGroups();
  return (
    <div className="flex flex-col gap-2">
      {(groups.data ?? [])
        .filter((g) => g.is_active)
        .map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[90px] shrink-0 text-[12px] font-semibold text-muted">{g.name}</span>
            {g.modifier_option
              .filter((o) => o.is_active)
              .map((o) => (
                <Chip key={o.id} on={value.includes(o.id)} onClick={() => onChange(toggle(value, o.id))}>
                  {o.name}
                </Chip>
              ))}
          </div>
        ))}
    </div>
  );
}

// "Mon, Wed · 14:00–16:00 · until 31 Oct" — for list rows
export function scheduleText(r: { weekdays: number[]; time_from: number | null; time_to: number | null; starts_at: string | null; ends_at: string | null }) {
  const parts: string[] = [];
  if (r.weekdays.length) parts.push(r.weekdays.map((d) => DAYS[d]).join(", "));
  if (r.time_from != null && r.time_to != null) parts.push(`${minutesToTime(r.time_from)}–${minutesToTime(r.time_to)}`);
  if (r.starts_at) parts.push(`from ${isoToDate(r.starts_at)}`);
  if (r.ends_at) parts.push(`until ${isoToDate(r.ends_at)}`);
  return parts.length ? parts.join(" · ") : "Always";
}
