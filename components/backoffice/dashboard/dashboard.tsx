"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Coffee, Gift, LayoutDashboard, Loader2, Package, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { errorText } from "@/lib/api";
import { useIngredients } from "@/lib/backoffice";
import { qty } from "@/lib/format";
import { useMediaQuery } from "@/lib/orientation";
import {
  addDays,
  bkkDay,
  dayDiff,
  dayNum,
  dow,
  hhmm,
  loyaltyAge,
  MAX_RANGE_DAYS,
  memberName,
  memberNo,
  nfmt,
  resolveRange,
  segments,
  SEG_META,
  sumDays,
  thb,
  thDate,
  thRange,
  TH_MON,
  useDashboard,
  type Metric,
  type RangeKey,
} from "@/lib/dashboard";
import { Btn } from "@/components/ui/btn";
import { Card, NeedsBE, Pill, Spinner, Toggle } from "@/components/ui/bits";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { ScrollRow } from "@/components/ui/scroll-row";
import { Sheet } from "@/components/ui/sheet";
import { Avatar, DTable, EmptyNote, MiniStat, dGrid } from "./kit";
import { DashMenu, DashOverview, DashSales } from "./tabs-sales";
import { DashCustomers, DashRewards, DashStock, lastVisitText, memberColor, memberCols } from "./tabs-loyalty";
import type { DashCtx, DashTab, Drill } from "./ctx";

// Back office · Dashboard: range picker, compare toggle, section tabs, drill-down sheets (design: dash-app.jsx)

const tabLabel = (I: LucideIcon, text: string) => (
  <span className="inline-flex items-center gap-1.5">
    <I size={15} strokeWidth={1.9} aria-hidden />
    {text}
  </span>
);
const DASH_TABS: { id: DashTab; label: ReactNode }[] = [
  { id: "overview", label: tabLabel(LayoutDashboard, "Overview") },
  { id: "sales", label: tabLabel(TrendingUp, "Sales") },
  { id: "menu", label: tabLabel(Coffee, "Menu") },
  { id: "customers", label: tabLabel(Users, "Customers") },
  { id: "rewards", label: tabLabel(Gift, "Rewards") },
  { id: "stock", label: tabLabel(Package, "Stock") },
];
const RANGE_OPTS: { id: RangeKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

function CalMonth({ month, a, b, today, onPick }: { month: string; a: string; b: string; today: string; onPick: (d: string) => void }) {
  const first = `${month}-01`;
  const n = dayDiff(first, `${addDays(first, 32).slice(0, 7)}-01`);
  const lead = (dow(first) + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(first, i))];
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="text-center text-[13.5px] font-semibold">
        {TH_MON[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="py-0.5 text-center text-[10.5px] font-semibold text-muted">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const fut = d > today;
          const inR = d >= a && d <= b;
          const end = d === a || d === b;
          return (
            <button
              key={i}
              type="button"
              disabled={fut}
              onClick={() => onPick(d)}
              className="tap mono h-[34px] text-[12.5px]"
              style={{
                borderRadius: end ? 8 : 4,
                fontWeight: end ? 700 : 500,
                background: end ? "var(--ink)" : inR ? "var(--paper-3)" : "transparent",
                color: end ? "var(--paper)" : fut ? "var(--muted-2)" : d === today ? "var(--persimmon-2)" : "var(--ink)",
                cursor: fut ? "default" : "pointer",
              }}
            >
              {dayNum(d)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomRangeSheet({ init, today, onClose, onApply }: { init: { from: string; to: string }; today: string; onClose: () => void; onApply: (v: { from: string; to: string }) => void }) {
  const [a, setA] = useState(init.from);
  const [b, setB] = useState<string | null>(init.to);
  const [view, setView] = useState(addDays(`${init.to.slice(0, 7)}-01`, -1).slice(0, 7));
  const wide = useMediaQuery("(min-width: 640px)", true);
  const pick = (d: string) => {
    if (b != null) {
      setA(d);
      setB(null);
    } else if (d < a) {
      setB(a);
      setA(d);
    } else setB(d);
  };
  const len = b != null ? dayDiff(a, b) + 1 : 1;
  const tooLong = len > MAX_RANGE_DAYS;
  const next = addDays(`${view}-01`, 32).slice(0, 7);
  const prevMonth = addDays(`${view}-01`, -1).slice(0, 7);
  const lastView = wide ? addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7) : today.slice(0, 7);
  return (
    <Sheet
      title="Custom range"
      sub="Tap a start day, then an end day. Compared with the same number of days before it."
      width={600}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-[13px] text-ink-2">
            {b == null ? (
              "Pick an end day"
            ) : tooLong ? (
              <span className="text-persimmon-2">At most {MAX_RANGE_DAYS} days</span>
            ) : (
              <>
                {thRange(a, b)} · <span className="mono">{len}</span> days
              </>
            )}
          </span>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={b == null || tooLong} onClick={() => b && onApply({ from: a, to: b })}>
            Apply
          </Btn>
        </>
      }
    >
      <div className="flex items-start gap-3 sm:gap-[18px]">
        <button type="button" className="tap h-8 w-8 shrink-0 rounded-full bg-paper-2" onClick={() => setView(prevMonth)}>
          ‹
        </button>
        <CalMonth month={view} a={a} b={b ?? a} today={today} onPick={pick} />
        {wide && <CalMonth month={next} a={a} b={b ?? a} today={today} onPick={pick} />}
        <button type="button" className="tap h-8 w-8 shrink-0 rounded-full bg-paper-2" disabled={view >= lastView} style={{ opacity: view >= lastView ? 0.4 : 1 }} onClick={() => setView(next)}>
          ›
        </button>
      </div>
    </Sheet>
  );
}

function LineMsgFooter({ n, onClose }: { n?: number; onClose: () => void }) {
  return (
    <>
      <span className="mr-auto self-center">
        <NeedsBE>LINE messaging</NeedsBE>
      </span>
      <Btn kind="secondary" onClick={onClose}>
        Close
      </Btn>
      <Btn kind="go" disabled>
        Send LINE message{n ? ` · ${n}` : ""}
      </Btn>
    </>
  );
}

function DrillSheet({ d, c, onClose }: { d: Drill; c: DashCtx; onClose: () => void }) {
  const { segs, r, D, now } = c;
  if (d.type === "segment") {
    const s = SEG_META[d.seg];
    const list = [...segs[d.seg]].sort((x, y) => (d.seg === "new" ? y.joined_at.localeCompare(x.joined_at) : y.spend_satang - x.spend_satang));
    return (
      <Sheet title={`${s.label} · ${list.length} member${list.length === 1 ? "" : "s"}`} sub={`${s.sub}${d.seg === "new" ? ` · ${r.label}` : " · as of today"}`} width={720} onClose={onClose} footer={<LineMsgFooter n={list.length} onClose={onClose} />}>
        {list.length === 0 ? (
          <EmptyNote title="Nobody here yet">
            {d.seg === "atRisk" || d.seg === "lapsed" ? "That's good news — or loyalty is too new for anyone to have drifted away." : "Members appear here as they scan receipts and join."}
          </EmptyNote>
        ) : (
          <Card>
            <DTable rows={list.slice(0, 40).map((m) => ({ ...m, key: m.id }))} onRow={(m) => c.drill({ type: "member", m })} cols={memberCols(now)} minWidth={520} />
          </Card>
        )}
        {list.length > 40 && <span className="text-[12px] text-muted">Showing 40 of {list.length}</span>}
      </Sheet>
    );
  }
  if (d.type === "member") {
    const m = d.m;
    return (
      <Sheet title={memberName(m)} sub={`${memberNo(m)} · joined ${thDate(bkkDay(m.joined_at))}`} onClose={onClose} width={480} footer={<LineMsgFooter onClose={onClose} />}>
        <div className="flex items-center gap-3.5">
          <Avatar name={memberName(m)} color={memberColor(m)} src={m.picture_url} size={56} />
          <div className="flex-1" style={dGrid(3)}>
            <MiniStat label="Visits" value={nfmt(m.visits)} />
            <MiniStat label="Spend" value={thb(m.spend_satang)} />
            <MiniStat label="Points" value={nfmt(m.points)} />
          </div>
        </div>
        <Card pad={14} className="flex flex-col gap-1.5 text-[13px]" style={{ background: "var(--paper-2)" }}>
          <span>
            Last visit · <b>{lastVisitText(m, now)}</b>
          </span>
          <span>
            Stamps · <span className="mono">{nfmt(m.stamps)}</span>
          </span>
          <span>
            Birthday · {m.birth_day && m.birth_month ? `${m.birth_day} ${TH_MON[m.birth_month - 1]}` : <span className="text-muted">not shared</span>}
          </span>
        </Card>
      </Sheet>
    );
  }
  if (d.type === "refunds") {
    const ev = D.events;
    return (
      <Sheet title={`Refunds & voids · ${ev.length}`} sub={`${r.label} · voids were never charged; refunds returned money`} width={720} onClose={onClose}>
        {ev.length === 0 ? (
          <EmptyNote title="Nothing in this range" />
        ) : (
          <Card>
            <DTable
              rows={ev.map((e, i) => ({ ...e, key: `${e.order_id}-${i}` }))}
              minWidth={600}
              cols={[
                { k: "kind", label: "", render: (e) => <Pill tone={e.kind === "REFUND" ? "REFUNDED" : "VOIDED"}>{e.kind === "REFUND" ? "Refund" : "Void"}</Pill> },
                { k: "num", label: "Order", render: (e) => <b className="font-semibold">#{e.order_number ?? "?"}</b> },
                { k: "when", label: "When", mono: true, render: (e) => <span className="whitespace-nowrap text-[12.5px] text-muted">{`${thDate(bkkDay(e.at))} ${hhmm(e.at)}`}</span> },
                { k: "staff", label: "By", render: (e) => e.staff_name ?? "Auto" },
                { k: "reason", label: "Reason", render: (e) => <span className="text-[12.5px] text-ink-2">{e.reason ?? "—"}</span> },
                { k: "amt", label: "Amount", align: "right", mono: true, render: (e) => thb(e.amount_satang) },
              ]}
            />
          </Card>
        )}
      </Sheet>
    );
  }
  const low = c.low;
  return (
    <Sheet
      title={`Low stock · ${low.length}`}
      sub="At or below reorder level, as of now"
      width={560}
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Close
          </Btn>
          <Btn kind="primary" onClick={() => c.go("/backoffice/inventory")}>
            Open Inventory
          </Btn>
        </>
      }
    >
      {low.length === 0 ? (
        <EmptyNote title="All stocked">Nothing is at or below its reorder level.</EmptyNote>
      ) : (
        <Card>
          <DTable
            rows={low.map((i) => ({ ...i, key: i.id }))}
            cols={[
              { k: "name", label: "Ingredient", render: (i) => i.name },
              { k: "s", label: "In stock", align: "right", mono: true, render: (i) => <span style={{ color: i.stock_quantity < 0 ? "var(--persimmon-2)" : "var(--ink)", fontWeight: 600 }}>{qty(i.stock_quantity, i.unit)}</span> },
              { k: "r", label: "Reorder at", align: "right", mono: true, render: (i) => qty(i.reorder_level, i.unit) },
            ]}
          />
        </Card>
      )}
    </Sheet>
  );
}

export function Dashboard() {
  const router = useRouter();
  const narrow = useMediaQuery("(max-width: 899px)", false);
  const [tab, setTab] = useState<DashTab>("overview");
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d");
  // a fresh clock each time the range changes (Today means up to now)
  const [now, setNow] = useState(() => new Date());
  const today = bkkDay(now);
  const [custom, setCustom] = useState(() => ({ from: addDays(today, -59), to: today }));
  const [pickCustom, setPickCustom] = useState(false);
  const [compare, setCompare] = useState(true);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [metric, setMetric] = useState<Metric>("net");

  const r = useMemo(() => resolveRange(rangeKey, custom, now), [rangeKey, custom, now]);
  const q = useDashboard(r);
  const ingredients = useIngredients();
  const D = q.data;
  // a new range is loading while the last one's numbers stay on screen
  const switching = q.isPlaceholderData;
  // what's on screen: the range these numbers belong to (not the one being loaded)
  const shown = D?.view ?? r;
  const failed = q.isError && !!D;

  const choose = (k: RangeKey) => {
    setNow(new Date());
    setRangeKey(k);
  };

  const c = useMemo<DashCtx | null>(() => {
    if (!D) return null;
    return {
      D,
      r: shown,
      cur: sumDays(D.days, D.range.from, D.range.to),
      prev: sumDays(D.days, D.range.prev_from, D.range.prev_to),
      compare,
      narrow,
      now,
      segs: segments(D, shown, now),
      low: (ingredients.data ?? []).filter((i) => i.is_active && i.stock_quantity <= i.reorder_level),
      age: loyaltyAge(D, now),
      drill: setDrill,
      go: (p) => router.push(p),
      // the body is keyed by tab, so it opens scrolled to the top
      setTab,
      metric,
      setMetric,
    };
  }, [D, shown, compare, narrow, now, ingredients.data, metric, router]);

  const Body = { overview: DashOverview, sales: DashSales, menu: DashMenu, customers: DashCustomers, rewards: DashRewards, stock: DashStock }[tab];
  const atRisk = c?.segs.atRisk.length ?? 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative flex shrink-0 flex-col gap-3 border-b border-line bg-paper px-4 pb-3 pt-4 sm:px-[22px] sm:pt-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div className="min-w-0" style={{ flex: "1 1 300px" }}>
            <div className="text-[22px] font-semibold tracking-[-0.4px]">Dashboard</div>
            <div className="mt-[3px] flex min-w-0 items-center gap-1.5 truncate text-[13px] text-muted" aria-live="polite">
              {switching ? (
                <>
                  <Loader2 size={14} strokeWidth={2.2} className="shrink-0 animate-spin text-persimmon" aria-hidden />
                  <span className="truncate font-semibold text-ink-2">Loading {r.label}…</span>
                </>
              ) : (
                <span className="truncate">
                  <span className="font-semibold text-ink-2">{shown.label}</span>
                  {compare && <> · vs {shown.prevLabel}</>}
                </span>
              )}
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-3">
            <ScrollRow selected={rangeKey} className="flex max-w-full">
              <GlassTabs<RangeKey>
                size="sm"
                items={RANGE_OPTS.map((o) => {
                  const label = o.id === "custom" && rangeKey === "custom" ? thRange(custom.from, custom.to) : o.label;
                  // the range just picked spins until its numbers arrive
                  return {
                    id: o.id,
                    label:
                      switching && o.id === rangeKey ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 size={13} strokeWidth={2.4} className="animate-spin" aria-hidden />
                          {label}
                        </span>
                      ) : (
                        label
                      ),
                  };
                })}
                value={rangeKey}
                onChange={(k) => (k === "custom" ? setPickCustom(true) : choose(k))}
              />
            </ScrollRow>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-ink-2">
              <Toggle on={compare} onChange={setCompare} />
              Compare
            </label>
          </div>
        </div>
        <ScrollRow selected={tab} className="flex max-w-full">
          <GlassTabs<DashTab> items={DASH_TABS.map((t) => ({ ...t, badge: t.id === "customers" && atRisk ? atRisk : 0 }))} value={tab} onChange={setTab} />
        </ScrollRow>
        {/* thin running bar on the header's edge while a range loads */}
        {(switching || (q.isFetching && !D)) && (
          <div className="pointer-events-none absolute inset-x-0 z-10 overflow-hidden" style={{ bottom: -2, height: 3 }} role="progressbar" aria-label="Loading">
            <div className="h-full w-1/3 rounded-full bg-persimmon" style={{ animation: "sheen 1.1s cubic-bezier(.4,0,.2,1) infinite" }} />
          </div>
        )}
      </div>
      <div key={tab} className="scroll fade-swap flex flex-1 flex-col gap-3.5 overflow-y-auto p-4 sm:p-[22px] [&>*]:shrink-0">
        {q.isError && !D ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="text-[15px] font-semibold text-ink">Couldn&apos;t load {r.label}</div>
            <div className="text-[13px] text-persimmon-2">{errorText(q.error)}</div>
            <Btn onClick={() => q.refetch()}>Retry</Btn>
          </div>
        ) : !c ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            {failed && (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line px-4 py-3 text-[13px]" style={{ background: "#F6DED7", color: "#8E3522" }}>
                <span className="flex-1">
                  Couldn&apos;t load {r.label} · still showing <b>{shown.label}</b> · {errorText(q.error)}
                </span>
                <Btn size="sm" onClick={() => q.refetch()}>
                  Retry
                </Btn>
              </div>
            )}
            {switching && (
              <div className="pointer-events-none sticky top-0 z-[5] -mb-3.5 flex justify-center">
                <span className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-2 shadow-md">
                  <Loader2 size={14} strokeWidth={2.2} className="animate-spin text-persimmon" aria-hidden />
                  Loading {r.label}…
                </span>
              </div>
            )}
            <div
              className="flex flex-col gap-3.5 [&>*]:shrink-0"
              // last range's numbers stay, faded and untouchable, until the new ones arrive
              style={{ opacity: switching ? 0.42 : 1, pointerEvents: switching ? "none" : undefined, transition: "opacity 180ms ease", filter: switching ? "saturate(0.6)" : undefined }}
              aria-busy={switching}
            >
              <Body c={c} />
            </div>
            <div className="pb-2 pt-1 text-center text-[11.5px] text-muted">Revenue only · whole baht, rounded · Thailand time (UTC+7) · weeks start Monday</div>
          </>
        )}
      </div>
      {pickCustom && (
        <CustomRangeSheet
          init={custom}
          today={today}
          onClose={() => setPickCustom(false)}
          onApply={(v) => {
            setCustom(v);
            choose("custom");
            setPickCustom(false);
          }}
        />
      )}
      {drill && c && <DrillSheet d={drill} c={c} onClose={() => setDrill(null)} />}
    </div>
  );
}
