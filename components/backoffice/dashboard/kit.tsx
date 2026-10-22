"use client";

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { Card, labelCls } from "@/components/ui/bits";
import { tdCls, thCls } from "@/components/ui/table";
import { ScrollRow } from "@/components/ui/scroll-row";
import { DOW_MON, nfmt, pct, sdiv, thb, type Point } from "@/lib/dashboard";

// Dashboard building blocks from the design's dash-kit: deltas, KPI cards, panels, charts, tables.

const TONE = { up: { bg: "#E3E9D6", fg: "#44552A" }, down: { bg: "#F6DED7", fg: "#8E3522" }, flat: { bg: "var(--paper-2)", fg: "var(--muted)" } };
const deltaCss = (t: keyof typeof TONE): CSSProperties => ({ background: TONE[t].bg, color: TONE[t].fg, fontSize: 11.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 });
export const dGrid = (cols: number, gap = 14): CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap });

/// change vs previous: % (or percentage points for rates); `invert` when going down is good
export function Delta({ cur, prev, invert, mode }: { cur: number; prev: number | null | undefined; invert?: boolean; mode?: "pts" }) {
  if (prev == null || !Number.isFinite(prev)) return null;
  let d: number;
  let txt: string;
  if (mode === "pts") {
    d = (cur - prev) * 100;
    txt = Math.abs(d).toFixed(1) + " pts";
  } else if (!prev) {
    return (
      <span className="mono" style={deltaCss("flat")}>
        {cur ? "New" : "—"}
      </span>
    );
  } else {
    d = ((cur - prev) / Math.abs(prev)) * 100;
    txt = Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0) + "%";
  }
  const tone = Math.abs(d) < 0.5 ? "flat" : d > 0 !== !!invert ? "up" : "down";
  return (
    <span className="mono" style={deltaCss(tone)}>
      {tone === "flat" ? "± " : d > 0 ? "▲ " : "▼ "}
      {txt}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  cur,
  prev,
  compare,
  mode,
  invert,
  foot,
  onClick,
  note,
}: {
  label: string;
  value: string;
  cur: number;
  prev?: number | null;
  compare: boolean;
  mode?: "pts";
  invert?: boolean;
  foot?: string | null;
  onClick?: () => void;
  note?: string | null;
}) {
  const body = (
    <>
      <span className={`${labelCls} flex justify-between gap-2`}>
        {label}
        {onClick && <span style={{ color: "var(--muted-2)", letterSpacing: 0 }}>›</span>}
      </span>
      <span className="mono num-tick" key={value} style={{ fontSize: 25, fontWeight: 600, letterSpacing: -0.5, color: "var(--ink)", lineHeight: 1.05 }}>
        {value}
      </span>
      <div className="flex min-h-5 flex-wrap items-center gap-2">
        {note ? (
          <span className="text-[12px] leading-[1.35] text-muted">{note}</span>
        ) : (
          <>
            {compare && <Delta cur={cur} prev={prev} mode={mode} invert={invert} />}
            {foot && <span className="whitespace-nowrap text-[12px] text-muted">{foot}</span>}
          </>
        )}
      </div>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-2 rounded-[14px] border border-line bg-card px-4 py-3.5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`tap ${cls}`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function AsOf({ children = "As of today" }: { children?: ReactNode }) {
  return <span className="ml-2 rounded-full bg-paper-2 px-2 py-[2px] align-[2px] text-[10.5px] font-semibold tracking-[0.2px] text-muted">{children}</span>;
}

export function Panel({ title, sub, right, children, pad = 16, style, asOf }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; pad?: number; style?: CSSProperties; asOf?: true | string }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", minWidth: 0, ...style }}>
      <div className="flex flex-wrap items-start gap-3 px-4 pt-3.5">
        <div className="min-w-[160px] flex-1">
          <div className="text-[14.5px] font-semibold tracking-[-0.1px]">
            {title}
            {asOf && <AsOf>{asOf === true ? "As of today" : asOf}</AsOf>}
          </div>
          {sub && <div className="mt-0.5 text-[12.5px] leading-[1.4] text-muted">{sub}</div>}
        </div>
        {right && <div className="flex shrink-0 gap-2">{right}</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3" style={{ padding: pad }}>
        {children}
      </div>
    </Card>
  );
}

export function EmptyNote({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-dashed border-line-2 bg-paper px-[18px] py-4">
      <span className="text-[13.5px] font-semibold text-ink-2">{title}</span>
      {children && <span className="text-[12.5px] leading-[1.45] text-muted">{children}</span>}
    </div>
  );
}

export function BarChart({
  data,
  fmt = nfmt,
  color = "var(--ink-2)",
  compare,
  height = 150,
  caption,
}: {
  data: Point[];
  fmt?: (v: number) => string;
  color?: string;
  compare?: boolean;
  height?: number;
  caption?: ReactNode;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1e-9, ...data.map((d) => Math.max(Math.abs(d.v), compare && d.p != null ? Math.abs(d.p) : 0)));
  const every = Math.ceil(data.length / (data.length > 20 ? 8 : 16));
  const h = hi != null ? data[hi] : null;
  const gap = data.length > 40 ? 1 : data.length > 16 ? 3 : 6;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="mono flex h-[18px] gap-3 overflow-hidden whitespace-nowrap text-[12px]" style={{ color: h ? "var(--ink)" : "var(--muted)" }}>
        {h ? (
          <>
            <span className="font-semibold">{h.full}</span>
            <span>{h.future ? "not yet" : fmt(h.v)}</span>
            {compare && h.p != null && <span className="text-muted">prev {fmt(h.p)}</span>}
          </>
        ) : (
          caption
        )}
      </div>
      <div onMouseLeave={() => setHi(null)} className="flex items-end border-b border-line" style={{ gap, height }}>
        {data.map((d, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} className="relative flex h-full min-w-0 flex-1 cursor-pointer items-end">
            {compare && d.p != null && <div className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-paper-3" style={{ height: `${(Math.abs(d.p) / max) * 100}%` }} />}
            <div
              className="relative mx-auto rounded-t-[3px]"
              style={{
                width: compare && d.p != null ? "58%" : "100%",
                height: `${(Math.abs(d.v) / max) * 100}%`,
                minHeight: d.v ? 2 : 0,
                background: d.future ? "transparent" : hi === i ? "var(--persimmon)" : color,
                opacity: d.weekend && hi !== i ? 0.78 : 1,
                transition: "height 420ms var(--ease-out), background-color 140ms ease",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap }}>
        {data.map((d, i) => (
          <div key={i} className="mono min-w-0 flex-1 whitespace-nowrap text-center text-[10.5px] text-muted">
            {i % every === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/// Above / below a zero line (cash variance per shift)
export function DivergingBars({ data, height = 120 }: { data: { full: string; v: number; sub?: string }[]; height?: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1000, ...data.map((d) => Math.abs(d.v)));
  const h = hi != null ? data[hi] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="mono flex h-[18px] gap-3 text-[12px]" style={{ color: h ? "var(--ink)" : "var(--muted)" }}>
        {h ? (
          <>
            <b>{h.full}</b>
            <span>{h.v === 0 ? "Balanced" : (h.v > 0 ? "+" : "") + thb(h.v)}</span>
            {h.sub && <span className="text-muted">{h.sub}</span>}
          </>
        ) : (
          "Tap a shift · bars below the line are short"
        )}
      </div>
      <div onMouseLeave={() => setHi(null)} className="relative flex" style={{ gap: data.length > 30 ? 1 : 3, height }}>
        <div className="absolute inset-x-0 top-1/2 border-t border-line-2" />
        {data.map((d, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} className="relative flex-1 cursor-pointer">
            {d.v === 0 ? (
              <div className="absolute rounded-[2px]" style={{ left: "30%", right: "30%", top: "calc(50% - 2px)", height: 4, background: hi === i ? "var(--ink)" : "var(--line-2)" }} />
            ) : (
              <div
                className="absolute inset-x-0 rounded-[3px]"
                style={{
                  background: hi === i ? "var(--ink)" : d.v < 0 ? "var(--persimmon)" : "var(--matcha)",
                  ...(d.v < 0 ? { top: "50%", height: `${(Math.abs(d.v) / max) * 50}%` } : { bottom: "50%", height: `${(d.v / max) * 50}%` }),
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const pad2h = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function Heatmap({ grid, hours }: { grid: number[][]; hours: number[] }) {
  const max = Math.max(1, ...grid.flat());
  const [hi, setHi] = useState<[number, number] | null>(null);
  let peak: [number, number] = [0, 0];
  let m = -1;
  grid.forEach((r, i) => r.forEach((v, j) => v > m && ((m = v), (peak = [i, j]))));
  const show = hi ?? peak;
  if (m <= 0 && !hi) return <EmptyNote title="No paid orders in this range" />;
  return (
    <div className="flex flex-col gap-2">
      <div className="mono h-[18px] text-[12px] text-ink">
        <b>
          {DOW_MON[show[0]]} {pad2h(hours[show[1]])}–{pad2h(hours[show[1]] + 1)}
        </b>{" "}
        <span className="text-muted">
          · {nfmt(grid[show[0]][show[1]])} orders{!hi ? " · busiest" : ""}
        </span>
      </div>
      <div onMouseLeave={() => setHi(null)} style={{ display: "grid", gridTemplateColumns: `36px repeat(${hours.length}, minmax(0,1fr))`, gap: 3 }}>
        {grid.map((row, i) => (
          <Fragment key={i}>
            <div className="self-center text-[11px] font-semibold text-muted">{DOW_MON[i]}</div>
            {row.map((v, j) => (
              <div
                key={j}
                onMouseEnter={() => setHi([i, j])}
                onClick={() => setHi([i, j])}
                className="h-6 cursor-pointer rounded-[5px]"
                style={{
                  background: v ? `color-mix(in oklch, var(--persimmon) ${Math.round(8 + (v / max) * 82)}%, var(--paper-2))` : "var(--paper-2)",
                  outline: hi && hi[0] === i && hi[1] === j ? "2px solid var(--ink)" : "none",
                  outlineOffset: -1,
                }}
              />
            ))}
          </Fragment>
        ))}
        <div />
        {hours.map((h) => (
          <div key={h} className="mono text-center text-[10.5px] text-muted">
            {h % 2 ? "" : h}
          </div>
        ))}
      </div>
    </div>
  );
}

export type SplitItem = { label: string; v: number; color: string; sub?: string };

export function SplitBar({ items, fmt = thb }: { items: SplitItem[]; fmt?: (v: number) => string }) {
  const t = items.reduce((s, i) => s + Math.max(0, i.v), 0) || 1;
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-paper-2">
        {items.map((i) => i.v > 0 && <div key={i.label} style={{ flexGrow: i.v, flexBasis: 0, background: i.color, transition: "flex-grow 420ms var(--ease-out)" }} />)}
      </div>
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-[13px]">
          <span className="h-[9px] w-[9px] shrink-0 rounded-[3px]" style={{ background: i.color }} />
          <span className="min-w-0 flex-1">
            {i.label}
            {i.sub && <span className="text-muted"> · {i.sub}</span>}
          </span>
          <span className="mono text-[12px] text-muted">{pct(Math.max(0, i.v) / t)}</span>
          <span className="mono min-w-[70px] text-right font-semibold">{fmt(i.v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Meter({ v, max = 1, color = "var(--ink-2)", h = 6 }: { v: number; max?: number; color?: string; h?: number }) {
  return (
    <div className="min-w-10 flex-1 overflow-hidden rounded-full bg-paper-2" style={{ height: h }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, sdiv(v, max) * 100)}%`, background: color, transition: "width 420ms var(--ease-out)" }} />
    </div>
  );
}

export function MiniStat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "neg" | "pos" | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="mono text-[20px] font-semibold" style={{ color: tone === "neg" ? "var(--persimmon-2)" : tone === "pos" ? "var(--matcha)" : "var(--ink)" }}>
        {value}
      </span>
      {sub && <span className="text-[11.5px] text-muted">{sub}</span>}
    </div>
  );
}

/// A photo when there is one (LINE profile, product image), else the first letter on a colour
export function Avatar({ name, color, src, size = 28, square }: { name: string; color: string; src?: string | null; size?: number; square?: boolean }) {
  const radius = square ? 7 : "50%";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 object-cover" style={{ width: size, height: size, borderRadius: radius, background: "var(--paper-2)" }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center font-semibold text-paper" style={{ width: size, height: size, borderRadius: radius, background: color, fontSize: size * 0.45 }}>
      {(name.trim()[0] ?? "·").toUpperCase()}
    </div>
  );
}

export type Col<T> = { k: string; label: ReactNode; align?: "left" | "right" | "center"; mono?: boolean; w?: number; render?: (row: T) => ReactNode };

export function DTable<T extends { key: string }>({ cols, rows, onRow, selected, minWidth = 0 }: { cols: Col<T>[]; rows: T[]; onRow?: (r: T) => void; selected?: string | null; minWidth?: number }) {
  return (
    <ScrollRow bar className="min-h-0">
      <table className="bo-table w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.k} className={thCls} style={{ textAlign: c.align ?? "left", width: c.w }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? "pointer" : "default", background: selected != null && selected === r.key ? "var(--paper-2)" : "transparent" }}>
              {cols.map((c) => (
                <td key={c.k} className={`${tdCls} ${c.mono ? "mono" : ""}`} style={{ padding: "9px 12px", textAlign: c.align ?? "left" }}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRow>
  );
}
