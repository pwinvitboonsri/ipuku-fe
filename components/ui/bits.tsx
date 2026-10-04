import type { CSSProperties, ReactNode } from "react";

// Small shared primitives from the design's ui.jsx.

export const labelCls = "text-[11px] text-muted tracking-[1.2px] font-semibold uppercase";

const PILL_TONES = {
  OPEN: { bg: "#F6ECCB", fg: "#7A5A0E" },
  PAID: { bg: "#E3E9D6", fg: "#44552A" },
  VOIDED: { bg: "var(--paper-3)", fg: "var(--ink-2)" },
  REFUNDED: { bg: "#F6DED7", fg: "#8E3522" },
  LOW: { bg: "#F6ECCB", fg: "#7A5A0E" },
  NEG: { bg: "#F6DED7", fg: "#8E3522" },
  OWNER: { bg: "var(--ink)", fg: "var(--paper)" },
  STAFF: { bg: "var(--paper-3)", fg: "var(--ink-2)" },
  INACTIVE: { bg: "var(--paper-3)", fg: "var(--muted)" },
  neutral: { bg: "var(--paper-2)", fg: "var(--ink-2)" },
} as const;
export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  const t = PILL_TONES[tone] ?? PILL_TONES.neutral;
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.6px]"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

// Flags UI that depends on a backend gap from the handbook's phase 2 backlog
export function NeedsBE({ children }: { children: ReactNode }) {
  return (
    <span className="mono whitespace-nowrap rounded-[6px] border border-dashed border-muted-2 px-[7px] py-[2px] text-[10.5px] text-muted">
      Needs BE · {children}
    </span>
  );
}

export function Card({ children, className = "", style, pad = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; pad?: number }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border border-line bg-card ${className}`} style={{ padding: pad, ...style }}>
      {children}
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[22px] font-semibold tracking-[-0.4px] text-ink">{title}</div>
        {sub && <div className="mt-[3px] text-[13px] text-muted">{sub}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "neg" | "pos" | null }) {
  const color = tone === "neg" ? "text-persimmon-2" : tone === "pos" ? "text-matcha" : "text-ink";
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <span className={`mono text-[20px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="tap relative h-6 w-[42px] shrink-0 rounded-full"
      style={{
        background: disabled ? "var(--paper-3)" : on ? "var(--matcha)" : "var(--line-2)",
        opacity: disabled ? 0.6 : 1,
        transition: "background-color 200ms ease",
      }}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white"
        style={{ left: on ? 21 : 3, boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left 220ms cubic-bezier(.3,1.4,.5,1)" }}
      />
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-2.5 w-2.5 rounded-full bg-yuzu" style={{ animation: "pulse 1.2s ease infinite" }} />
      {label && <div className="text-[14px] font-medium text-ink-2">{label}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="text-[12.5px] font-medium text-persimmon-2">{children}</div>;
}
