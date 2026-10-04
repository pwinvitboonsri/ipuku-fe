"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import type { MenuGroup, MenuOption, MenuProduct } from "@/lib/types";
import { ItemPhoto } from "./item-photo";
import { QtyStepper } from "./qty-stepper";

// Options sheet. One block per group in sort_order; radio when max_select = 1, checkboxes otherwise.
// "Add" stays disabled until every group has at least min_select picks (the server enforces the same rule).

function ruleLabel(g: MenuGroup) {
  if (g.min >= 1) return g.min === g.max ? `Required · pick ${g.min}` : `Required · pick ${g.min}–${g.max}`;
  return g.max === 1 ? "Optional" : `Optional · up to ${g.max}`;
}

export function ModifierModal({ item, onClose, onAdd }: { item: MenuProduct; onClose: () => void; onAdd: (options: MenuOption[], qty: number) => void }) {
  const groups = item.groups;
  const [sel, setSel] = useState<Record<string, string[]>>(() => Object.fromEntries(groups.map((g) => [g.id, []])));
  const [qty, setQty] = useState(1);

  const missing = groups.filter((g) => (sel[g.id]?.length ?? 0) < g.min);
  const canAdd = missing.length === 0;
  const chosen = groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)));
  const unit = item.price_satang + chosen.reduce((s, o) => s + o.price_delta_satang, 0);

  function toggle(g: MenuGroup, optId: string) {
    setSel((s) => {
      const cur = s[g.id] ?? [];
      if (g.max === 1) {
        if (cur[0] === optId) return g.min === 0 ? { ...s, [g.id]: [] } : s;
        return { ...s, [g.id]: [optId] };
      }
      if (cur.includes(optId)) return { ...s, [g.id]: cur.filter((x) => x !== optId) };
      if (cur.length >= g.max) return s;
      return { ...s, [g.id]: [...cur, optId] };
    });
  }

  return (
    <div className="modal-backdrop absolute inset-0 z-10 flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(28,24,20,0.42)" }} onClick={onClose}>
      <div className="modal-card flex max-h-[92%] w-full max-w-[520px] flex-col overflow-hidden rounded-[18px] bg-paper shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center gap-3 border-b border-line p-3.5 sm:gap-4 sm:p-[18px]">
          <div className="w-16 shrink-0 sm:w-[84px]">
            <ItemPhoto id={item.id} name={item.name} imageUrl={item.image_url} size="hero" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold tracking-[1.2px] text-muted">CUSTOMIZE</div>
            <div className="mt-0.5 text-[19px] font-semibold tracking-[-0.3px] text-ink sm:text-[22px]">{item.name}</div>
            <div className="mono mt-1.5 text-[13px] text-ink-2 sm:text-[14px]">
              {money(item.price_satang)} base<span className="hidden sm:inline"> · preview, server confirms</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="tap flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-[16px] font-medium text-ink-2">
            ×
          </button>
        </div>

        <div className="scroll flex-1 overflow-y-auto px-3.5 pb-[18px] pt-2 sm:px-[18px]">
          {groups.length === 0 && <div className="py-6 text-center text-[14px] text-muted">No customizations available.</div>}
          {groups.map((g) => {
            const multi = g.max > 1;
            const picked = sel[g.id] ?? [];
            const isMissing = missing.includes(g);
            return (
              <div key={g.id} className="border-b border-line py-3.5">
                <div className="mb-2.5 flex items-baseline gap-2.5">
                  <span className="text-[14px] font-semibold text-ink">{g.name}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.5px] ${isMissing ? "text-persimmon" : "text-muted"}`}>{ruleLabel(g)}</span>
                  {multi && (
                    <span className="mono ml-auto text-[11px] text-muted">
                      {picked.length}/{g.max}
                    </span>
                  )}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: g.options.length > 3 ? "repeat(2, 1fr)" : `repeat(${g.options.length}, 1fr)` }}>
                  {g.options.map((opt) => {
                    const on = picked.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role={multi ? "checkbox" : "radio"}
                        aria-checked={on}
                        onClick={() => toggle(g, opt.id)}
                        className="tap flex min-h-14 flex-col justify-center gap-0.5 rounded-[10px] px-3.5 py-3 text-left"
                        style={{ background: on ? "var(--ink)" : "var(--card)", color: on ? "var(--paper)" : "var(--ink)", border: on ? "1px solid var(--ink)" : "1px solid var(--line-2)" }}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span className="flex items-center gap-2 text-[14px] font-medium">
                            <span
                              className="h-3 w-3 shrink-0"
                              style={{
                                borderRadius: multi ? 3 : "50%",
                                border: "1.5px solid currentColor",
                                opacity: on ? 1 : 0.45,
                                background: on ? "currentColor" : "transparent",
                                boxShadow: on ? "inset 0 0 0 2px var(--ink)" : "none",
                              }}
                            />
                            {opt.name}
                          </span>
                          {opt.price_delta_satang !== 0 && (
                            <span className="mono whitespace-nowrap text-[11px] font-medium" style={{ color: on ? "rgba(245,241,232,0.72)" : "var(--muted)" }}>
                              {opt.price_delta_satang > 0 ? "+" : ""}
                              {money(opt.price_delta_satang)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 border-t border-line bg-paper-2 p-3 sm:gap-3.5 sm:p-4">
          <QtyStepper value={qty} onChange={setQty} />
          <button
            type="button"
            onClick={() => canAdd && onAdd(chosen, qty)}
            disabled={!canAdd}
            className="tap flex flex-1 items-center justify-between rounded-[12px] p-4 text-[15px] font-semibold"
            style={{ background: canAdd ? "var(--ink)" : "var(--paper-3)", color: canAdd ? "var(--paper)" : "var(--muted)" }}
          >
            <span>{canAdd ? "Add to order" : `Select ${missing[0].name.toLowerCase()}`}</span>
            {canAdd && <span className="mono text-[15px]">{money(unit * qty)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
