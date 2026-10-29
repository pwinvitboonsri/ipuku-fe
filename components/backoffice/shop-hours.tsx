"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { bahtText, parseBaht, useBoMutation } from "@/lib/backoffice";
import { money } from "@/lib/format";
import {
  DAY_LONG,
  DEFAULT_WEEK,
  hhmm,
  planText,
  rangeLabel,
  shopHoursKey,
  todayPlanKey,
  useShopHours,
  dayLabel,
  type DayHours,
  type DayPlan,
  type ShopHours,
  type SpecialDay,
  type SpecialKind,
  type SpecialSaved,
} from "@/lib/shop-hours";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, PageHead, Pill, Toggle, labelCls } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { ScrollRow } from "@/components/ui/scroll-row";
import { Loadable } from "./common";
import { minutesToTime, timeToMinutes } from "./loyalty/shared";

// Back office → Opening hours: shifts that open and close by themselves, the weekly pattern
// (a change can start on a future date), and special days (closed ranges, special hours).

const KEYS = [shopHoursKey, todayPlanKey];
const timeCls = "h-10 rounded-[10px] border border-line-2 bg-card px-2.5 text-[14px] text-ink disabled:opacity-40";

function AutoCard({ data }: { data: ShopHours }) {
  const s = data.settings;
  const [grace, setGrace] = useState(String(s.auto_close_grace_minutes));
  const [float, setFloat] = useState(bahtText(s.default_float_satang));
  const save = useBoMutation((body: object) => api.post("/shop-hours/settings/update", body), KEYS);
  const graceN = Number(grace);
  const floatS = parseBaht(float || "0");
  const dirty = graceN !== s.auto_close_grace_minutes || floatS !== s.default_float_satang;
  const valid = Number.isInteger(graceN) && graceN >= 0 && graceN <= 240 && floatS != null;
  return (
    <Card pad={16} className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[15px] font-semibold">Automatic shifts</div>
          <div className="mt-0.5 text-[12.5px] leading-[1.45] text-muted">
            A shift opens when the POS is first used during opening hours and closes by itself after closing time. Unpaid orders are voided then, and the cash isn&apos;t counted. Staff can still open and close shifts by hand.
          </div>
        </div>
        <Toggle on={s.auto_shift} disabled={save.isPending} onChange={(v) => save.mutate({ auto_shift: v })} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Close after closing time" hint="Minutes staff can keep selling after closing">
          <TextInput value={grace} onChange={setGrace} inputMode="numeric" suffix="min" mono />
        </Field>
        <Field label="Opening float" hint="Cash an automatic shift starts with">
          <TextInput value={float} onChange={setFloat} inputMode="decimal" prefix="฿" mono />
        </Field>
        <Btn kind="primary" disabled={!dirty || !valid || save.isPending} onClick={() => save.mutate({ auto_close_grace_minutes: graceN, default_float_satang: floatS })}>
          {save.isPending ? "Saving…" : "Save"}
        </Btn>
      </div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Card>
  );
}

// Past 14 days and the next 14: what each day is, so a mistake shows before it happens
function DayStrip({ data, onPick }: { data: ShopHours; onPick: (d: DayPlan) => void }) {
  return (
    <ScrollRow selected={data.today} className="flex gap-2 pb-1">
      {data.days.map((d) => {
        const today = d.date === data.today;
        const special = !!d.special_id;
        return (
          <button
            key={d.date}
            type="button"
            // a tab strip of days; the row scrolls the selected one (today) into view
            role="tab"
            aria-selected={today}
            onClick={() => onPick(d)}
            className="tap flex w-[104px] shrink-0 flex-col gap-1 rounded-[12px] border px-2.5 py-2 text-left"
            style={{
              borderColor: today ? "var(--ink)" : "var(--line)",
              background: !d.open ? "var(--paper-2)" : special ? "#F6ECCB" : "var(--card)",
              opacity: d.past ? 0.75 : 1,
            }}
          >
            <span className="text-[11px] font-semibold text-muted">{today ? "Today" : dayLabel(d.date)}</span>
            <span className="text-[12.5px] font-semibold" style={{ color: d.open ? "var(--ink)" : "var(--muted)" }}>
              {d.open ? `${hhmm(d.open_min)}–${hhmm(d.close_min)}` : "Closed"}
            </span>
            <span className="truncate text-[11px] text-muted">{d.note ?? (d.past && d.open ? (d.orders ? `${d.orders} orders` : "no sales") : special ? "special" : " ")}</span>
          </button>
        );
      })}
    </ScrollRow>
  );
}

function WeekEditor({ data }: { data: ShopHours }) {
  const inForce = data.weekly.find((w) => w.in_force);
  const upcoming = data.weekly.filter((w) => w.upcoming);
  const [days, setDays] = useState<DayHours[]>(inForce?.days ?? DEFAULT_WEEK);
  const [asking, setAsking] = useState(false);
  const [from, setFrom] = useState(data.today);
  const save = useBoMutation((body: object) => api.post("/shop-hours/weekly/create", body), KEYS, { onSuccess: () => setAsking(false) });
  const del = useBoMutation((id: string) => api.post(`/shop-hours/weekly/${id}/delete`), KEYS);
  const set = (i: number, patch: Partial<DayHours>) => setDays((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const bad = days.some((d) => d.open && d.close_min <= d.open_min);
  const changed = JSON.stringify(days) !== JSON.stringify(inForce?.days ?? null);
  // Monday first on screen
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Card pad={16} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-semibold">Weekly hours</div>
        <span className="text-[12px] text-muted">{inForce ? `In force since ${dayLabel(inForce.effective_from)}` : "Not set yet — shifts won't open by themselves"}</span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {order.map((i) => {
          const d = days[i];
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <span className="w-[92px] text-[13.5px] font-medium">{DAY_LONG[i]}</span>
              <Toggle on={d.open} onChange={(v) => set(i, { open: v })} />
              {d.open ? (
                <span className="flex items-center gap-2 text-[13px]">
                  <input type="time" className={timeCls} value={minutesToTime(d.open_min)} onChange={(e) => set(i, { open_min: timeToMinutes(e.target.value) ?? d.open_min })} />
                  <span className="text-muted">to</span>
                  <input type="time" className={timeCls} value={minutesToTime(d.close_min)} onChange={(e) => set(i, { close_min: timeToMinutes(e.target.value) ?? d.close_min })} />
                  {d.close_min <= d.open_min && <span className="text-[12px] text-persimmon-2">closes before it opens</span>}
                </span>
              ) : (
                <span className="text-[13px] text-muted">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Btn kind="primary" disabled={!changed || bad} onClick={() => setAsking(true)}>
          Save hours…
        </Btn>
      </div>
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[12px] bg-paper-2 p-3">
          <span className={labelCls}>Planned changes</span>
          {upcoming.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-2 text-[13px]">
              <b className="font-semibold">From {dayLabel(w.effective_from)}</b>
              <span className="min-w-0 flex-1 text-ink-2">{weekSummary(w.days)}</span>
              <Btn size="sm" kind="ghost" disabled={del.isPending} onClick={() => del.mutate(w.id)}>
                Remove
              </Btn>
            </div>
          ))}
          {del.isError && <ErrorNote>{errorText(del.error)}</ErrorNote>}
        </div>
      )}
      {asking && (
        <Sheet
          title="From when?"
          sub="Days before this keep their old hours. Pick a later date to plan a change ahead."
          onClose={() => setAsking(false)}
          width={420}
          footer={
            <>
              <Btn onClick={() => setAsking(false)}>Cancel</Btn>
              <Btn kind="primary" disabled={!from || from < data.today || save.isPending} onClick={() => save.mutate({ effective_from: from, days })}>
                {save.isPending ? "Saving…" : `Start ${from === data.today ? "today" : dayLabel(from)}`}
              </Btn>
            </>
          }
        >
          <input type="date" className={timeCls} value={from} min={data.today} onChange={(e) => setFrom(e.target.value)} />
          <div className="text-[13px] text-ink-2">{weekSummary(days)}</div>
          {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
        </Sheet>
      )}
    </Card>
  );
}

/// "Mon–Fri 10:00–18:00 · Sun 10:00–16:00 · Sat closed"
function weekSummary(days: DayHours[]) {
  const groups: { days: number[]; text: string }[] = [];
  for (const i of [1, 2, 3, 4, 5, 6, 0]) {
    const d = days[i];
    const text = d.open ? `${hhmm(d.open_min)}–${hhmm(d.close_min)}` : "closed";
    const last = groups.at(-1);
    if (last && last.text === text && last.days.at(-1) === (i === 0 ? 6 : i - 1)) last.days.push(i);
    else groups.push({ days: [i], text });
  }
  const name = (i: number) => DAY_LONG[i].slice(0, 3);
  return groups.map((g) => `${g.days.length > 2 ? `${name(g.days[0])}–${name(g.days.at(-1)!)}` : g.days.map(name).join(", ")} ${g.text}`).join(" · ");
}

function SpecialSheet({ data, row, date, onClose }: { data: ShopHours; row: SpecialDay | null; date: string | null; onClose: () => void }) {
  const [kind, setKind] = useState<SpecialKind>(row?.kind ?? "CLOSED");
  const [from, setFrom] = useState(row?.from_date ?? date ?? data.today);
  const [to, setTo] = useState(row?.to_date ?? date ?? data.today);
  const [open, setOpen] = useState<number>(row?.open_min ?? 600);
  const [close, setClose] = useState<number>(row?.close_min ?? 1080);
  const [note, setNote] = useState(row?.note ?? "");
  const [result, setResult] = useState<SpecialSaved | null>(null);
  const body = { kind, from_date: from, to_date: kind === "HOURS" ? from : to, ...(kind === "HOURS" && { open_min: open, close_min: close }), note: note.trim() || undefined };
  const save = useBoMutation(() => api.post<SpecialSaved>(row ? `/shop-hours/special/${row.id}/update` : "/shop-hours/special/create", body), KEYS, {
    onSuccess: (r) => (r.removed || r.kept_days_with_sales.length ? setResult(r) : onClose()),
  });
  const del = useBoMutation(() => api.post(`/shop-hours/special/${row!.id}/delete`), KEYS, { onSuccess: onClose });
  const ok = from && (kind === "HOURS" || to >= from) && (kind === "CLOSED" || close > open);
  const past = from < data.today;

  if (result) {
    return (
      <Sheet title="Saved" onClose={onClose} width={420} footer={<Btn kind="primary" onClick={onClose}>Done</Btn>}>
        <div className="text-[13.5px] leading-[1.5] text-ink-2">
          {result.removed > 0 && <p>Removed {result.removed} empty automatic shift{result.removed === 1 ? "" : "s"} on those days — they won&apos;t count on the dashboard.</p>}
          {result.kept_days_with_sales.length > 0 && <p className="mt-2">Kept the shifts on {result.kept_days_with_sales.map(dayLabel).join(", ")}: they have sales.</p>}
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet
      title={row ? "Edit special day" : "Add special day"}
      sub={past && kind === "CLOSED" ? "Marking past days closed removes their empty automatic shifts; days with sales keep theirs." : "Overrides the weekly hours on these days."}
      onClose={onClose}
      width={460}
      footer={
        <>
          {row && (
            <Btn kind="dangerSoft" disabled={del.isPending} onClick={() => del.mutate(undefined)} className="mr-auto">
              Delete
            </Btn>
          )}
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" disabled={!ok || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : "Save"}
          </Btn>
        </>
      }
    >
      <Segmented<SpecialKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: "CLOSED", label: "Closed" },
          { value: "HOURS", label: "Special hours" },
        ]}
      />
      {kind === "CLOSED" ? (
        <Field label="Days" hint="Both dates included">
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            <input type="date" className={timeCls} value={from} onChange={(e) => (setFrom(e.target.value), to < e.target.value && setTo(e.target.value))} />
            <span className="text-muted">to</span>
            <input type="date" className={timeCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </span>
        </Field>
      ) : (
        <>
          <Field label="Day">
            <input type="date" className={timeCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Hours">
            <span className="flex items-center gap-2 text-[13px]">
              <input type="time" className={timeCls} value={minutesToTime(open)} onChange={(e) => setOpen(timeToMinutes(e.target.value) ?? open)} />
              <span className="text-muted">to</span>
              <input type="time" className={timeCls} value={minutesToTime(close)} onChange={(e) => setClose(timeToMinutes(e.target.value) ?? close)} />
            </span>
          </Field>
        </>
      )}
      <Field label="Note" hint="Optional, e.g. Vacation, Songkran">
        <TextInput value={note} onChange={setNote} placeholder="Vacation" />
      </Field>
      {(save.isError || del.isError) && <ErrorNote>{errorText(save.error ?? del.error)}</ErrorNote>}
    </Sheet>
  );
}

function SpecialList({ data, onEdit, onAdd }: { data: ShopHours; onEdit: (s: SpecialDay) => void; onAdd: () => void }) {
  const upcoming = data.specials.filter((s) => s.to_date >= data.today).sort((a, b) => a.from_date.localeCompare(b.from_date));
  const past = data.specials.filter((s) => s.to_date < data.today).slice(0, 10);
  const row = (s: SpecialDay) => (
    <button key={s.id} type="button" onClick={() => onEdit(s)} className="tap flex w-full flex-wrap items-center gap-2 py-2.5 text-left text-[13.5px]">
      <span className="min-w-[180px] font-medium">{rangeLabel(s.from_date, s.to_date)}</span>
      {s.kind === "CLOSED" ? <Pill tone="INACTIVE">Closed</Pill> : <Pill tone="OPEN">{`${hhmm(s.open_min)}–${hhmm(s.close_min)}`}</Pill>}
      <span className="min-w-0 flex-1 truncate text-ink-2">{s.note ?? ""}</span>
      <span className="text-muted-2">›</span>
    </button>
  );
  return (
    <Card pad={16} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[15px] font-semibold">Special days</div>
        <Btn size="sm" kind="primary" onClick={onAdd}>
          + Add
        </Btn>
      </div>
      {upcoming.length === 0 && past.length === 0 && <div className="py-2 text-[13px] text-muted">None yet. Add holidays, vacations or days with different hours.</div>}
      {upcoming.length > 0 && <div className="flex flex-col divide-y divide-line">{upcoming.map(row)}</div>}
      {past.length > 0 && (
        <>
          <span className={`${labelCls} mt-2`}>Past</span>
          <div className="flex flex-col divide-y divide-line opacity-75">{past.map(row)}</div>
        </>
      )}
    </Card>
  );
}

export function ShopHoursAdmin() {
  const q = useShopHours();
  const [sheet, setSheet] = useState<{ row: SpecialDay | null; date: string | null } | null>(null);
  return (
    <div className="scroll flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 sm:p-5 lg:p-[22px]" data-noshrink="1" data-screen-label="Back office · Opening hours">
      <PageHead title="Opening hours" sub="When the shop is open. Shifts follow it when automatic shifts are on, and closed days are left out of the dashboard." />
      <Loadable queries={[q]}>
        {() => {
          const data = q.data!;
          return (
            <>
              <AutoCard data={data} />
              <Card pad={16} className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[15px] font-semibold">Last 2 weeks and next 2 weeks</div>
                  <span className="text-[12px] text-muted">Tap a day to close it or give it special hours</span>
                </div>
                <DayStrip
                  data={data}
                  onPick={(d) => {
                    const covering = d.special_id ? data.specials.find((s) => s.id === d.special_id) ?? null : null;
                    setSheet({ row: covering, date: d.date });
                  }}
                />
                <div className="text-[12px] text-muted">
                  Today: <b className="text-ink-2">{planText(data.days.find((d) => d.date === data.today)!)}</b>
                  {data.settings.auto_shift ? ` · automatic shifts on, float ${money(data.settings.default_float_satang)}` : " · automatic shifts off"}
                </div>
              </Card>
              <WeekEditor key={data.weekly.find((w) => w.in_force)?.id ?? "none"} data={data} />
              <SpecialList data={data} onEdit={(s) => setSheet({ row: s, date: null })} onAdd={() => setSheet({ row: null, date: null })} />
              {sheet && <SpecialSheet key={`${sheet.row?.id}-${sheet.date}`} data={data} row={sheet.row} date={sheet.date} onClose={() => setSheet(null)} />}
            </>
          );
        }}
      </Loadable>
    </div>
  );
}
