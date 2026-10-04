"use client";

import { useState, type ReactNode } from "react";
import { clock, money } from "@/lib/format";
import { methodLabel } from "@/lib/orders";
import type { ReportAdjustment, ShiftReport as Report } from "@/lib/types";
import { Card, Stat, labelCls } from "@/components/ui/bits";

// End-of-shift (Z) report, shared by the close-shift success screen and back office → Shifts.
// Everything is computed by the BE (GET /cash-session/:id/report); this only lays it out.

const TOP_N = 8;

const signed = (v: number) => (v === 0 ? money(0) : (v > 0 ? "+" : "") + money(v));
const duration = (m: number | null) => (m == null ? "open" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card pad={16} className="flex flex-col gap-1">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={labelCls}>{title}</span>
        {right && <span className="text-[12px] text-muted">{right}</span>}
      </div>
      {children}
    </Card>
  );
}

function Row({ k, v, sub, strong, tone }: { k: ReactNode; v: ReactNode; sub?: ReactNode; strong?: boolean; tone?: "neg" | "pos" | null }) {
  const color = tone === "neg" ? "text-persimmon-2" : tone === "pos" ? "text-matcha" : "";
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "mt-1 border-t border-line pt-2 text-[14.5px] font-semibold" : "text-[13.5px]"}`}>
      <span className={`min-w-0 ${strong ? "text-ink" : "text-ink-2"}`}>
        {k}
        {sub && <span className="ml-1.5 text-[12px] text-muted">{sub}</span>}
      </span>
      <span className={`mono shrink-0 ${color}`}>{v}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="py-1 text-[13px] text-muted">{children}</div>;
}

// Qty × revenue list, top N with "Show all".
function RankList({ rows, empty }: { rows: { key: string; name: ReactNode; sub?: string; quantity: number; revenue_satang: number }[]; empty: string }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <Empty>{empty}</Empty>;
  const shown = all ? rows : rows.slice(0, TOP_N);
  return (
    <>
      {shown.map((r) => (
        <Row key={r.key} k={r.name} sub={r.sub} v={<><span className="mr-3 text-muted">×{r.quantity}</span>{money(r.revenue_satang)}</>} />
      ))}
      {rows.length > TOP_N && (
        <button type="button" onClick={() => setAll((v) => !v)} className="tap mt-1 self-start text-[12.5px] font-medium text-ink-2 underline underline-offset-2">
          {all ? "Show top " + TOP_N : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}

// Single series → one hue, no legend; per-bar tooltip, peak hour labelled.
function HourlyBars({ hourly }: { hourly: Report["hourly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!hourly.length) return <Empty>No paid orders yet.</Empty>;
  const max = Math.max(...hourly.map((h) => h.net_sales_satang), 1);
  const peak = hourly.findIndex((h) => h.net_sales_satang === max);
  const shown = hover ?? peak;
  const h = hourly[shown];
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12.5px] text-ink-2" aria-live="polite">
        <span className="mono font-semibold text-ink">{clock(h.hour_start)}</span> · {h.orders} {h.orders === 1 ? "order" : "orders"} · <span className="mono">{money(h.net_sales_satang)}</span>
        {hover == null && <span className="text-muted"> · peak hour</span>}
      </div>
      <div className="flex h-[96px] items-end gap-[2px] border-b border-line" onMouseLeave={() => setHover(null)}>
        {hourly.map((b, i) => (
          <button
            key={b.hour_start}
            type="button"
            aria-label={`${clock(b.hour_start)}: ${b.orders} orders, ${money(b.net_sales_satang)}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            className="flex h-full min-w-0 flex-1 items-end justify-center"
          >
            <span
              className="block w-full max-w-[28px] rounded-t-[4px]"
              style={{ height: `${Math.max(3, (b.net_sales_satang / max) * 100)}%`, background: "var(--yuzu)", opacity: i === shown ? 1 : 0.55, transition: "opacity 120ms ease" }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-[2px] text-[10.5px] text-muted">
        {hourly.map((b, i) => (
          <span key={b.hour_start} className="mono min-w-0 flex-1 truncate text-center">
            {i === 0 || i === hourly.length - 1 || hourly.length <= 8 ? clock(b.hour_start).slice(0, 2) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function AdjustmentList({ list, empty }: { list: ReportAdjustment[]; empty: string }) {
  if (!list.length) return <Empty>{empty}</Empty>;
  return (
    <>
      {list.map((a) => (
        <div key={a.order_id} className="flex items-baseline gap-3 border-t border-line py-2 text-[13px] first:border-t-0">
          <span className="mono w-10 shrink-0 font-semibold">#{a.order_number}</span>
          <span className="min-w-0 flex-1">
            <span className="text-ink">{a.reason ?? "No reason recorded"}</span>
            <span className="block text-[12px] text-muted">
              {clock(a.at)}
              {a.staff_name ? ` · ${a.staff_name}` : ""}
              {a.method ? ` · ${methodLabel(a.method)}` : ""}
            </span>
          </span>
          <span className="mono shrink-0">{money(a.amount_satang)}</span>
        </div>
      ))}
    </>
  );
}

export function ShiftReport({ report: r }: { report: Report }) {
  const s = r.summary;
  const c = r.cash;
  const variance = c.variance_satang;
  const range = r.session.first_order_number != null ? `#${r.session.first_order_number}–#${r.session.last_order_number}` : "no orders";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <span>
          {clock(r.session.open_at)}–{r.session.close_at ? clock(r.session.close_at) : "now"} · {duration(r.session.duration_minutes)}
        </span>
        <span>Orders {range}</span>
        <span>
          Opened by {r.session.opened_by.name}
          {r.session.closed_by ? ` · closed by ${r.session.closed_by.name}` : ""}
        </span>
      </div>

      <Card pad={16} className="grid grid-cols-2 gap-4 min-[560px]:grid-cols-4">
        <Stat label="Net sales" value={money(s.net_sales_satang)} />
        <Stat label="Paid orders" value={s.paid_orders} />
        <Stat label="Avg ticket" value={money(s.avg_ticket_satang)} />
        <Stat label="Items sold" value={s.items_sold} />
      </Card>

      <Section title="Sales">
        <Row k="Gross sales" v={money(s.gross_sales_satang)} />
        <Row k="Discounts" v={s.discounts_satang ? money(-s.discounts_satang) : money(0)} />
        <Row k="Refunds" sub={r.refunds.count ? `${r.refunds.count} ${r.refunds.count === 1 ? "order" : "orders"}` : undefined} v={s.refunds_satang ? money(-s.refunds_satang) : money(0)} />
        <Row k="Net sales" v={money(s.net_sales_satang)} strong />
        <Row k="Voided (not charged)" sub={`${r.voids.count} ${r.voids.count === 1 ? "order" : "orders"}`} v={money(r.voids.amount_satang)} />
      </Section>

      <Section title="Payments">
        {r.tenders.map((t) => (
          <Row
            key={t.method}
            k={methodLabel(t.method)}
            sub={`${t.count} ${t.count === 1 ? "payment" : "payments"}${t.refunds_satang ? ` · ${money(-t.refunds_satang)} refunded` : ""}`}
            v={money(t.net_satang)}
          />
        ))}
        <Row k="Total" v={money(r.tenders.reduce((t, l) => t + l.net_satang, 0))} strong />
        {s.split_orders > 0 && (
          <div className="mt-1 text-[12px] text-muted">
            {s.split_orders} {s.split_orders === 1 ? "order was" : "orders were"} split across methods — each part is counted under its own method.
          </div>
        )}
      </Section>

      <Section title="Cash drawer">
        <Row k="Opening float" v={money(c.opening_float_satang)} />
        <Row k="+ Cash sales" v={money(c.cash_sales_satang)} />
        <Row k="− Cash refunds" v={c.cash_refunds_satang ? money(-c.cash_refunds_satang) : money(0)} />
        <Row k="Expected in drawer" v={money(c.expected_satang)} strong />
        <Row k="Counted" v={c.counted_satang != null ? money(c.counted_satang) : "—"} />
        <Row k="Variance" v={variance != null ? signed(variance) : "—"} tone={variance ? (variance < 0 ? "neg" : "pos") : null} />
        <div className="mt-1 text-[12px] text-muted">
          Tendered <span className="mono">{money(c.tendered_satang)}</span> · change given <span className="mono">{money(c.change_given_satang)}</span>
        </div>
      </Section>

      <Section title="Sales by hour" right="net sales">
        <HourlyBars hourly={r.hourly} />
      </Section>

      <Section title="Items sold" right="paid orders">
        <RankList rows={r.items.map((i) => ({ key: i.product_id, name: i.name, sub: i.category_name, quantity: i.quantity, revenue_satang: i.revenue_satang }))} empty="Nothing sold yet." />
      </Section>

      <Section title="Categories">
        <RankList rows={r.categories.map((i) => ({ key: i.category_id, name: i.name, quantity: i.quantity, revenue_satang: i.revenue_satang }))} empty="Nothing sold yet." />
      </Section>

      <Section title="Add-ons">
        <RankList rows={r.modifiers.map((i) => ({ key: i.modifier_option_id, name: i.name, quantity: i.quantity, revenue_satang: i.revenue_satang }))} empty="No add-ons sold." />
      </Section>

      <Section title="By staff" right="who rang the order">
        {r.staff.length ? (
          r.staff.map((p) => (
            <Row
              key={p.staff_id}
              k={p.name}
              sub={[`${p.paid_orders} paid`, p.voids ? `${p.voids} void` : "", p.refunds ? `${p.refunds} refund` : ""].filter(Boolean).join(" · ")}
              v={money(p.net_sales_satang)}
            />
          ))
        ) : (
          <Empty>No orders yet.</Empty>
        )}
      </Section>

      <Section title="Refunds" right={r.refunds.count ? money(r.refunds.amount_satang) : undefined}>
        <AdjustmentList list={r.refunds.list} empty="No refunds." />
      </Section>

      <Section title="Voids" right={r.voids.count ? money(r.voids.amount_satang) : undefined}>
        <AdjustmentList list={r.voids.list} empty="No voids." />
      </Section>
    </div>
  );
}
