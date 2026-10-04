"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { errorText } from "@/lib/api";
import { Btn } from "@/components/ui/btn";
import { Spinner } from "@/components/ui/bits";
import { inputCls } from "@/components/ui/form";

// Loading / error states for a back-office screen that needs one or more queries.
export function Loadable({ queries, children }: { queries: UseQueryResult[]; children: () => ReactNode }) {
  const failed = queries.find((q) => q.isError);
  if (failed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-[13px] text-persimmon-2">{errorText(failed.error)}</div>
        <Btn onClick={() => queries.forEach((q) => q.isError && q.refetch())}>Retry</Btn>
      </div>
    );
  }
  if (queries.some((q) => q.isPending)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <>{children()}</>;
}

export function Select({ value, onChange, children, className = "", disabled }: { value: string; onChange: (v: string) => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${className}`}>
      {children}
    </select>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="tap flex items-center gap-1.5 self-start py-1 text-[13.5px] font-semibold text-ink-2">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

export function Move({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  return (
    <div className="flex flex-col">
      <button type="button" aria-label="Move up" onClick={onUp} disabled={first} className="tap h-3.5 text-[10px]" style={{ color: first ? "var(--muted-2)" : "var(--ink-2)" }}>
        ▲
      </button>
      <button type="button" aria-label="Move down" onClick={onDown} disabled={last} className="tap h-3.5 text-[10px]" style={{ color: last ? "var(--muted-2)" : "var(--ink-2)" }}>
        ▼
      </button>
    </div>
  );
}

export const swap = <T,>(list: T[], i: number, j: number) => {
  const n = [...list];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
};
