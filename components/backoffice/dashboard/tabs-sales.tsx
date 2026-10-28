"use client";

import { useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Pill, labelCls } from "@/components/ui/bits";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { itemTone } from "@/lib/tone";
import {
  addDays,
  avgTicket,
  bkkDay,
  claimRate,
  dayNum,
  dow,
  DOW_SUN,
  heatGrid,
  hhmm,
  hourSpan,
  memberShare,
  nfmt,
  pct,
  sdiv,
  series,
  thb,
  thDate,
  type Metric,
  type Point,
} from "@/lib/dashboard";
import { Banknote, Coffee, ChartColumn, ChartPie, Clock, CreditCard, Flame, PackageX, Receipt, ReceiptText, RotateCcw, ScanLine, SlidersHorizontal, Store, Tag, TrendingUp, Trophy, UserPlus, Hourglass, BellRing } from "lucide-react";
import { Avatar, BarChart, Delta, DTable, EmptyNote, Heatmap, Ico, KpiCard, Meter, MiniStat, Panel, SplitBar, dGrid } from "./kit";
import type { DashCtx } from "./ctx";

// Dashboard tabs · Overview, Sales, Menu

function SalesByDay({ c }: { c: DashCtx }) {
  const { D, r, compare, metric, setMetric, now } = c;
  const m: Metric = metric === "orders" || metric === "avg" ? metric : "net";
  const hourly = r.from === r.to;
  return (
    <Panel
      icon={hourly ? Clock : ChartColumn}
      title={hourly ? (r.key === "today" ? "Today by hour" : "By hour") : "By day"}
      sub={compare ? `Grey = ${hourly ? (r.key === "today" ? "yesterday" : "the day compared") : "same day in previous period"}` : null}
      right={
        <GlassTabs<Metric>
          size="sm"
          radius={12}
          value={m}
          onChange={setMetric}
          items={[
            { id: "net", label: "Net sales" },
            { id: "orders", label: "Orders" },
            { id: "avg", label: "Avg ticket" },
          ]}
        />
      }
    >
      <BarChart data={series(D, r, m, now)} fmt={m === "orders" ? nfmt : thb} compare={compare} height={c.narrow ? 140 : 170} caption={hourly ? "Tap an hour" : "Tap a day · weekends shown lighter"} />
    </Panel>
  );
}

function AttentionRow({ label, value, sub, tone, icon, onClick }: { label: string; value: string; sub?: string; tone: "bad" | "warn" | "ok"; icon: typeof Clock; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tap flex w-full items-center gap-3 rounded-[10px] border border-line bg-paper px-3 py-[11px] text-left">
      <Ico icon={icon} tone={tone === "bad" ? "persimmon" : tone === "warn" ? "yuzu" : "matcha"} size={30} />
      <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
        <span className="text-[13.5px] font-semibold">{label}</span>
        {sub && <span className="text-[12px] text-muted">{sub}</span>}
      </span>
      <span className="mono text-[15px] font-semibold">{value}</span>
      <span className="text-muted-2">›</span>
    </button>
  );
}

export function DashOverview({ c }: { c: DashCtx }) {
  const { cur, prev, compare, segs, narrow, age, low } = c;
  const young = age < 7;
  const cr = claimRate(cur);
  const kpis = [
    { icon: Banknote, tone: "yuzu" as const, label: "Net sales", value: thb(cur.net_satang), cur: cur.net_satang, prev: prev.net_satang },
    { icon: Receipt, tone: "ink" as const, label: "Orders", value: nfmt(cur.orders), cur: cur.orders, prev: prev.orders },
    { icon: ReceiptText, tone: "cocoa" as const, label: "Average ticket", value: thb(avgTicket(cur)), cur: avgTicket(cur), prev: avgTicket(prev) },
    { icon: Coffee, tone: "cocoa" as const, label: "Items sold", value: nfmt(cur.items), cur: cur.items, prev: prev.items },
    {
      icon: ChartPie,
      tone: "matcha" as const,
      label: "Member share of sales",
      value: pct(memberShare(cur)),
      cur: memberShare(cur),
      prev: memberShare(prev),
      mode: "pts" as const,
      note: young ? (age ? `Grows as members claim receipts. Loyalty started ${age} day${age === 1 ? "" : "s"} ago.` : "Grows as members claim receipts.") : null,
      onClick: () => c.setTab("customers"),
    },
    { icon: UserPlus, tone: "matcha" as const, label: "New members", value: nfmt(cur.new_members), cur: cur.new_members, prev: prev.new_members, onClick: () => c.drill({ type: "segment", seg: "new" }) },
  ];
  return (
    <>
      <div className="stagger" style={dGrid(narrow ? 2 : 3)}>
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} compare={compare} />
        ))}
      </div>
      <SalesByDay c={c} />
      <div style={dGrid(narrow ? 1 : 3)}>
        <Panel icon={Store} title="Channel" sub="Revenue by where the order came from">
          <SplitBar
            items={[
              { label: "Walk-in", v: cur.walk_sales_satang, color: "var(--ink-2)", sub: `${nfmt(cur.walk_orders)} orders` },
              { label: "Grab", v: cur.grab_sales_satang, color: "var(--matcha)", sub: `${nfmt(cur.grab_orders)} orders` },
            ]}
          />
        </Panel>
        <Panel icon={ScanLine} tone="matcha" title="Receipt claim rate" sub="Walk-in receipts scanned by a member">
          {young && cur.claimed < 20 ? (
            <EmptyNote title={`${pct(cr)} so far`}>Claim rate grows as customers scan receipts. Point to the QR when you hand it over.</EmptyNote>
          ) : (
            <>
              <div className="flex items-baseline gap-2.5">
                <span className="mono text-[30px] font-semibold tracking-[-0.5px]">{pct(cr)}</span>
                {compare && <Delta cur={cr} prev={claimRate(prev)} mode="pts" />}
              </div>
              <div className="flex">
                <Meter v={cr} color="var(--persimmon)" h={8} />
              </div>
              <span className="text-[12px] text-muted">
                <span className="mono">{nfmt(cur.claimed)}</span> of <span className="mono">{nfmt(cur.walk_orders)}</span> walk-in receipts
              </span>
            </>
          )}
        </Panel>
        <Panel icon={BellRing} tone="persimmon" title="Needs a look" pad={12}>
          <div className="flex flex-col gap-1.5">
            <AttentionRow icon={PackageX} label="Low stock" sub="At or below reorder level" value={nfmt(low.length)} tone={low.some((i) => i.stock_quantity < 0) ? "bad" : low.length ? "warn" : "ok"} onClick={() => c.drill({ type: "lowstock" })} />
            <AttentionRow icon={Hourglass} label="Members at risk" sub="No visit in 30–60 days" value={nfmt(segs.atRisk.length)} tone={segs.atRisk.length ? "warn" : "ok"} onClick={() => c.drill({ type: "segment", seg: "atRisk" })} />
            <AttentionRow icon={RotateCcw} label="Refunds & voids" sub={thb(cur.refund_satang + cur.void_satang)} value={nfmt(cur.refunds + cur.voids)} tone={cur.refunds ? "warn" : "ok"} onClick={() => c.drill({ type: "refunds" })} />
          </div>
        </Panel>
      </div>
    </>
  );
}

export function DashSales({ c }: { c: DashCtx }) {
  const { D, r, cur, prev, compare, narrow } = c;
  const heat = heatGrid(D, r);
  const pay = cur.cash_satang + cur.promptpay_satang + cur.grab_pay_satang;
  const prevPay = prev.cash_satang + prev.promptpay_satang + prev.grab_pay_satang;
  const codes = D.reward_discount_satang + D.coupon_discount_satang;
  return (
    <>
      <SalesByDay c={c} />
      <Panel icon={Flame} tone="persimmon" title="Busiest times" sub={`Orders by hour and weekday · ${r.label}`}>
        <Heatmap grid={heat.grid} hours={heat.hours} />
      </Panel>
      <div style={dGrid(narrow ? 1 : 2)}>
        <Panel icon={Store} title="Channel split">
          <span className={labelCls}>Revenue</span>
          <SplitBar
            items={[
              { label: "Walk-in", v: cur.walk_sales_satang, color: "var(--ink-2)" },
              { label: "Grab", v: cur.grab_sales_satang, color: "var(--matcha)" },
            ]}
          />
          <span className={`${labelCls} mt-1`}>Orders</span>
          <SplitBar
            fmt={nfmt}
            items={[
              { label: "Walk-in", v: cur.walk_orders, color: "var(--ink-2)" },
              { label: "Grab", v: cur.grab_orders, color: "var(--matcha)" },
            ]}
          />
          {cur.grab_rejected > 0 && (
            <span className="text-[12px] text-muted">
              {nfmt(cur.grab_rejected)} Grab order{cur.grab_rejected > 1 ? "s" : ""} rejected
            </span>
          )}
        </Panel>
        <Panel icon={CreditCard} tone="matcha" title="Payment mix" sub="Money taken, after refunds">
          <SplitBar
            items={[
              { label: "PromptPay", v: cur.promptpay_satang, color: "var(--persimmon)" },
              { label: "Cash", v: cur.cash_satang, color: "var(--yuzu)" },
              { label: "Grab", v: cur.grab_pay_satang, color: "var(--matcha)" },
            ]}
          />
          {compare && (
            <div className="flex items-center gap-2 text-[12px] text-muted">
              PromptPay share <Delta cur={sdiv(cur.promptpay_satang, pay)} prev={sdiv(prev.promptpay_satang, prevPay)} mode="pts" />
            </div>
          )}
        </Panel>
        <Panel icon={Tag} tone="yuzu" title="Discounts given" sub="Rewards and coupons redeemed at the counter">
          {cur.discount_satang < 100 ? (
            <EmptyNote title="No discounts yet">Appear once members start redeeming rewards and coupons.</EmptyNote>
          ) : (
            <>
              <div style={dGrid(2)}>
                <MiniStat label="Total" value={thb(cur.discount_satang)} />
                <MiniStat label="Share of sales" value={pct(sdiv(cur.discount_satang, cur.gross_satang), 1)} />
              </div>
              {compare && (
                <div className="flex items-center gap-2 text-[12px] text-muted">
                  vs previous <Delta cur={cur.discount_satang} prev={prev.discount_satang} invert />
                </div>
              )}
              {codes > 0 && (
                <SplitBar
                  items={[
                    { label: "Reward redemptions", v: D.reward_discount_satang, color: "var(--persimmon)" },
                    { label: "Coupons", v: D.coupon_discount_satang, color: "var(--yuzu)" },
                  ]}
                />
              )}
            </>
          )}
        </Panel>
        <Panel
          icon={RotateCcw}
          tone="persimmon"
          title="Refunds & voids"
          right={
            D.events.length > 0 && (
              <Btn kind="ghost" size="sm" onClick={() => c.drill({ type: "refunds" })}>
                See all {D.events.length}
              </Btn>
            )
          }
        >
          <div style={dGrid(2)}>
            <MiniStat label="Refunds" value={nfmt(cur.refunds)} sub={thb(cur.refund_satang)} tone={cur.refunds ? "neg" : null} />
            <MiniStat label="Voids" value={nfmt(cur.voids)} sub={`${thb(cur.void_satang)} never charged`} />
          </div>
          {D.events.length === 0 ? (
            <EmptyNote title="Nothing to review">No refunds or voids in this range.</EmptyNote>
          ) : (
            <div className="flex flex-col border-t border-line">
              {D.events.slice(0, 3).map((e, i) => (
                <div key={i} className="flex items-center gap-2.5 border-b border-line py-[9px] text-[13px]">
                  <Pill tone={e.kind === "REFUND" ? "REFUNDED" : "VOIDED"}>{e.kind === "REFUND" ? "Refund" : "Void"}</Pill>
                  <span className="min-w-0 flex-1 truncate">
                    #{e.order_number ?? "?"} · {e.reason ?? "No reason given"}
                  </span>
                  <span className="mono text-[12px] text-muted">{thDate(bkkDay(e.at))}</span>
                  <span className="mono font-semibold">{thb(e.amount_satang)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

type ProductRow = DashCtx["D"]["products"][number] & { key: string };

/// units of one product per day (or hour) of the range, with the previous range alongside
function productTrend(c: DashCtx, productId: string): Point[] {
  const { D, r } = c;
  const rows = D.product_series.filter((x) => x.product_id === productId);
  if (r.from === r.to) {
    const nowHour = r.key === "today" ? Number(hhmm(c.now).slice(0, 2)) : 24;
    const at = (date: string, h: number) => rows.filter((x) => x.date === date && x.hour === h).reduce((t, x) => t + x.quantity, 0);
    return hourSpan(D).map((h) => ({ label: String(h), full: `${String(h).padStart(2, "0")}:00`, future: h > nowHour, v: h > nowHour ? 0 : at(r.from, h), p: at(r.prevFrom, h) }));
  }
  const on = (date: string) => rows.filter((x) => x.date === date).reduce((t, x) => t + x.quantity, 0);
  return Array.from({ length: r.len }, (_, i) => {
    const date = addDays(r.from, i);
    const pd = addDays(r.prevFrom, i);
    return { label: String(dayNum(date)), full: `${DOW_SUN[dow(date)]} ${thDate(date)}`, v: on(date), p: pd <= r.prevTo ? on(pd) : null, weekend: dow(date) === 0 || dow(date) === 6 };
  });
}

const CAT_COLORS = ["var(--matcha)", "var(--yuzu)", "var(--ink-2)", "var(--persimmon)", "#A06B3E", "var(--muted-2)"];

export function DashMenu({ c }: { c: DashCtx }) {
  const { D, r, narrow, compare } = c;
  const [by, setBy] = useState<"rev" | "qty">("rev");
  const [end, setEnd] = useState<"top" | "bottom">("top");
  const all: ProductRow[] = D.products.filter((p) => p.quantity > 0 || p.prev_quantity > 0).map((p) => ({ ...p, key: p.product_id }));
  const val = (x: ProductRow) => (by === "rev" ? x.revenue_satang : x.quantity);
  const sorted = [...all].sort((a, b) => val(b) - val(a));
  const rows = (end === "top" ? sorted : [...sorted].reverse()).slice(0, 8);
  const [pick, setPick] = useState<string | null>(null);
  const sel = all.find((x) => x.key === pick) ?? sorted[0];
  const maxV = Math.max(1, ...all.map(val));
  const cats = new Map<string, { label: string; v: number }>();
  for (const p of all) cats.set(p.category_id, { label: p.category_name, v: (cats.get(p.category_id)?.v ?? 0) + p.revenue_satang });
  const options = [...D.options].sort((a, b) => b.revenue_satang - a.revenue_satang || b.picked - a.picked).slice(0, 10);

  if (all.length === 0) {
    return (
      <Panel icon={Trophy} tone="yuzu" title="Products">
        <EmptyNote title="Nothing sold in this range">Products show up here once orders are paid.</EmptyNote>
      </Panel>
    );
  }
  return (
    <>
      <Panel
        icon={Trophy}
        tone="yuzu"
        title={`${end === "top" ? "Top" : "Bottom"} products`}
        sub="Tap a product to see its trend"
        pad={0}
        right={
          <div className="flex flex-wrap justify-end gap-2">
            <GlassTabs<"top" | "bottom"> size="sm" radius={12} value={end} onChange={setEnd} items={[{ id: "top", label: "Top" }, { id: "bottom", label: "Bottom" }]} />
            <GlassTabs<"rev" | "qty"> size="sm" radius={12} value={by} onChange={setBy} items={[{ id: "rev", label: "Revenue" }, { id: "qty", label: "Quantity" }]} />
          </div>
        }
      >
        <div className="h-3" />
        <DTable
          rows={rows}
          onRow={(x) => setPick(x.key)}
          selected={sel?.key}
          minWidth={560}
          cols={[
            {
              k: "n",
              label: "Product",
              render: (x) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={x.name} color={itemTone(x.product_id)} src={x.image_url} square />
                  <span className="whitespace-nowrap font-medium">{x.name}</span>
                </div>
              ),
            },
            { k: "c", label: "Category", render: (x) => <span className="text-[12.5px] text-muted">{x.category_name}</span> },
            { k: "bar", label: "", w: narrow ? 80 : 140, render: (x) => <Meter v={val(x)} max={maxV} color={x.key === sel?.key ? "var(--persimmon)" : "var(--ink-2)"} /> },
            { k: "qty", label: "Qty", align: "right", mono: true, render: (x) => nfmt(x.quantity) },
            { k: "rev", label: "Revenue", align: "right", mono: true, render: (x) => thb(x.revenue_satang) },
            ...(compare ? [{ k: "d", label: "vs prev", align: "right" as const, render: (x: ProductRow) => <Delta cur={val(x)} prev={by === "rev" ? x.prev_revenue_satang : x.prev_quantity} /> }] : []),
          ]}
        />
      </Panel>
      <div style={dGrid(narrow ? 1 : 2)}>
        {sel && (
          <Panel icon={TrendingUp} title={sel.name} sub={`Sold per ${r.from === r.to ? "hour" : "day"} · ${nfmt(sel.quantity)} in range`}>
            <BarChart data={productTrend(c, sel.product_id)} fmt={(v) => `${nfmt(v)} sold`} compare={compare} height={120} caption="Tap a bar" />
          </Panel>
        )}
        <Panel icon={ChartPie} tone="cocoa" title="Category mix" sub="Share of revenue">
          <SplitBar items={[...cats.values()].sort((a, b) => b.v - a.v).map((x, i) => ({ label: x.label, v: x.v, color: CAT_COLORS[i % CAT_COLORS.length] }))} />
        </Panel>
      </div>
      <Panel icon={SlidersHorizontal} tone="cocoa" title="Options" sub="How often an option is picked on the items that offer it, and what it adds" pad={0}>
        <div className="h-3" />
        {options.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyNote title="No options picked in this range" />
          </div>
        ) : (
          <DTable
            rows={options.map((o) => ({ ...o, key: o.modifier_option_id }))}
            minWidth={520}
            cols={[
              {
                k: "l",
                label: "Option",
                render: (o) => (
                  <span>
                    <b className="font-semibold">{o.name}</b> <span className="text-muted">· {o.group_name}</span>
                  </span>
                ),
              },
              {
                k: "bar",
                label: "Attach rate",
                w: narrow ? 120 : 220,
                render: (o) => (
                  <div className="flex items-center gap-2.5">
                    <Meter v={sdiv(o.picked, o.base)} color="var(--matcha)" />
                    <span className="mono w-9 text-right text-[12.5px] font-semibold">{pct(sdiv(o.picked, o.base))}</span>
                  </div>
                ),
              },
              { k: "n", label: "Times picked", align: "right", mono: true, render: (o) => nfmt(o.picked) },
              { k: "rev", label: "Add-on revenue", align: "right", mono: true, render: (o) => (o.price_delta_satang ? thb(o.revenue_satang) : <span className="text-muted">free</span>) },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
