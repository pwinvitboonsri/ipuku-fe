"use client";

import { useState } from "react";
import { useIngredients, useMovements, type MovementFilter } from "@/lib/backoffice";
import { clock, qty, shortDate } from "@/lib/format";
import type { StockReason } from "@/lib/types";
import { PageHead } from "@/components/ui/bits";
import { inputCls } from "@/components/ui/form";
import { FilterChips } from "@/components/ui/glass-tabs";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { Loadable, Select } from "./common";
import { OrderSheet } from "./order-sheet";

const REASON_LABEL: Record<StockReason, string> = { SALE: "Sale", RESTOCK: "Restock", WASTE: "Waste", COUNT_CORRECTION: "Count correction" };

// yyyy-mm-dd in local time, for <input type="date">
const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOf = (s: string) => new Date(`${s}T00:00:00`).toISOString();
const endOf = (s: string) => new Date(new Date(`${s}T00:00:00`).getTime() + 86_400_000).toISOString();

export function StockHistory() {
  const ingredients = useIngredients();
  const [reason, setReason] = useState<"ALL" | StockReason>("ALL");
  const [ing, setIng] = useState("");
  const [from, setFrom] = useState(() => dayStr(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(() => dayStr(new Date()));
  const [orderId, setOrderId] = useState<string | null>(null);

  const filter: MovementFilter = {
    ...(reason !== "ALL" && { reason }),
    ...(ing && { ingredient_id: ing }),
    ...(from && { after: startOf(from) }),
    ...(to && { before: endOf(to) }),
  };
  const moves = useMovements(filter);

  return (
    <div className="scroll flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 sm:p-5 lg:p-[22px]" data-noshrink="1" data-screen-label="Back office · Stock history">
      <PageHead title="Stock history" sub="Every change to stock, newest first." />
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterChips
          value={reason}
          onChange={setReason}
          options={[{ value: "ALL" as const, label: "All" }, ...(Object.keys(REASON_LABEL) as StockReason[]).map((r) => ({ value: r, label: REASON_LABEL[r] }))]}
        />
        <Select value={ing} onChange={setIng} className="!w-auto min-w-[180px] flex-1 !py-2 !text-[13px] sm:max-w-[240px] sm:flex-none">
          <option value="">All ingredients</option>
          {(ingredients.data ?? []).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} !w-auto !py-2 !text-[13px]`} aria-label="From" />
          –
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${inputCls} !w-auto !py-2 !text-[13px]`} aria-label="To" />
        </div>
      </div>
      <Loadable queries={[moves]}>
        {() => (
          <Table minWidth={560}>
            <thead>
              <tr>
                <th className={thCls}>When</th>
                <th className={thCls}>Ingredient</th>
                <th className={thCls}>Reason</th>
                <th className={`${thCls} text-right`}>Change</th>
                <th className={thCls}>Source</th>
              </tr>
            </thead>
            <tbody>
              {moves.data!.map((m) => (
                <tr key={m.id}>
                  <td className={`${tdCls} mono whitespace-nowrap text-muted`}>
                    {shortDate(m.create_at)} {clock(m.create_at)}
                  </td>
                  <td className={`${tdCls} font-medium`}>{m.ingredient.name}</td>
                  <td className={tdCls}>{REASON_LABEL[m.reason]}</td>
                  <td className={`${tdCls} mono whitespace-nowrap text-right font-semibold`} style={{ color: m.change_quantity < 0 ? "var(--persimmon-2)" : "var(--matcha)" }}>
                    {m.change_quantity > 0 ? "+" : ""}
                    {qty(m.change_quantity, m.ingredient.unit)}
                  </td>
                  <td className={`${tdCls} text-[12.5px]`}>
                    {m.order_id ? (
                      <button type="button" onClick={() => setOrderId(m.order_id)} className="tap font-semibold text-ink underline-offset-2 hover:underline">
                        View order →
                      </button>
                    ) : (
                      <span className="text-ink-2">{m.note || "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {moves.data!.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${tdCls} py-8 text-center text-muted`}>
                    No stock changes for these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Loadable>
      <div className="text-[12px] text-muted">Who made an adjustment is kept in the audit log.</div>
      {orderId && <OrderSheet orderId={orderId} onClose={() => setOrderId(null)} />}
    </div>
  );
}
