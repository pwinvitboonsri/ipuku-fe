"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { MENU_KEY, bo, parseQty, qtyText, useBoMutation, useIngredients } from "@/lib/backoffice";
import { qty } from "@/lib/format";
import type { Ingredient } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, PageHead, Pill, Toggle } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { FilterChips, Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { Loadable } from "./common";

type Reason = "RESTOCK" | "WASTE" | "COUNT_CORRECTION";
// MENU_KEY: the counter grid shows Low / Out tags computed from stock
const KEYS = [bo.ingredients, ["bo", "movements"], MENU_KEY];
const num = (v: string) => v.replace(/[^\d.]/g, "");

export function stockTone(i: Ingredient) {
  return i.stock_quantity < 0 ? "NEG" : i.stock_quantity <= i.reorder_level ? "LOW" : null;
}

// Restock must add, Waste must remove, Count correction either way. Staff type a positive amount;
// the sign comes from the reason.
function AdjustSheet({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const [reason, setReason] = useState<Reason>("RESTOCK");
  const [dir, setDir] = useState<"+" | "-">("+");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const n = parseQty(amt) ?? 0;
  const sign = reason === "RESTOCK" ? 1 : reason === "WASTE" ? -1 : dir === "+" ? 1 : -1;
  const change = n * sign;
  const after = ing.stock_quantity + change;
  const save = useBoMutation(
    () => api.post("/stock-movement/adjust", { ingredient_id: ing.id, change_quantity: change, reason, ...(note.trim() && { note: note.trim() }) }),
    KEYS,
    { onSuccess: onClose },
  );
  return (
    <Sheet
      title={`Adjust · ${ing.name}`}
      sub={`Currently ${qty(ing.stock_quantity, ing.unit)} · reorder at ${qty(ing.reorder_level, ing.unit)}`}
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={n <= 0 || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : "Save adjustment"}
          </Btn>
        </>
      }
    >
      <Field label="Reason">
        <Segmented<Reason>
          value={reason}
          onChange={setReason}
          options={[
            { value: "RESTOCK", label: "Restock" },
            { value: "WASTE", label: "Waste" },
            { value: "COUNT_CORRECTION", label: "Count fix" },
          ]}
        />
      </Field>
      {reason === "COUNT_CORRECTION" && (
        <Field label="Direction">
          <Segmented<"+" | "-">
            value={dir}
            onChange={setDir}
            options={[
              { value: "+", label: "Found more (+)" },
              { value: "-", label: "Found less (−)" },
            ]}
          />
        </Field>
      )}
      <Field label="Amount" hint={reason === "RESTOCK" ? "Added to stock" : reason === "WASTE" ? "Removed from stock" : "Difference between system and shelf"}>
        <TextInput value={amt} onChange={(v) => setAmt(num(v))} suffix={ing.unit} mono inputMode="decimal" placeholder="0" autoFocus />
      </Field>
      <Field label="Note" hint="Optional">
        <TextInput value={note} onChange={(v) => setNote(v.slice(0, 255))} placeholder={reason === "RESTOCK" ? "Supplier / invoice" : "What happened?"} />
      </Field>
      <Card pad={14} className="flex flex-wrap items-center gap-3" style={{ background: "var(--paper-2)" }}>
        <span className="mono text-[15px]" style={{ color: ing.stock_quantity < 0 ? "var(--persimmon-2)" : "var(--ink-2)" }}>
          {qty(ing.stock_quantity, ing.unit)}
        </span>
        <span className="text-muted">→</span>
        <span className="mono text-[17px] font-semibold" style={{ color: after < 0 ? "var(--persimmon-2)" : "var(--ink)" }}>
          {qty(after, ing.unit)}
        </span>
        <span className="mono ml-auto text-[13px]" style={{ color: change < 0 ? "var(--persimmon-2)" : "var(--matcha)" }}>
          {n ? (change > 0 ? "+" : "") + qty(change, ing.unit) : ""}
        </span>
      </Card>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

// Create, or edit name / unit / reorder level. Stock itself only changes through sales and adjustments.
function IngredientSheet({ ing, onClose }: { ing: Ingredient | null; onClose: () => void }) {
  const [name, setName] = useState(ing?.name ?? "");
  const [unit, setUnit] = useState(ing?.unit ?? "");
  const [stock, setStock] = useState("0");
  const [reorder, setReorder] = useState(ing ? qtyText(ing.reorder_level) : "");
  const reorderH = parseQty(reorder);
  const stockH = parseQty(stock);
  const changes: Record<string, unknown> = {};
  if (ing) {
    if (name.trim() !== ing.name) changes.name = name.trim();
    if (unit.trim() !== ing.unit) changes.unit = unit.trim();
    if (reorderH !== null && reorderH !== ing.reorder_level) changes.reorder_level = reorderH;
  }
  const save = useBoMutation(
    () =>
      ing
        ? api.post(`/ingredient/${ing.id}/update`, changes)
        : api.post("/ingredient/create", { name: name.trim(), unit: unit.trim(), stock_quantity: stockH, reorder_level: reorderH, is_active: true }),
    KEYS,
    { onSuccess: onClose },
  );
  const toggle = useBoMutation(() => api.post(`/ingredient/${ing!.id}/update-status`), KEYS, { onSuccess: onClose });
  const valid = name.trim() && unit.trim() && reorderH !== null && (ing || stockH !== null);
  const canSave = valid && (!ing || Object.keys(changes).length > 0) && !save.isPending;
  return (
    <Sheet
      title={ing ? `Edit · ${ing.name}` : "New ingredient"}
      onClose={onClose}
      footer={
        <>
          {ing && (
            <Btn kind={ing.is_active ? "dangerSoft" : "secondary"} disabled={toggle.isPending} onClick={() => toggle.mutate(undefined)} className="mr-auto">
              {ing.is_active ? "Deactivate" : "Reactivate"}
            </Btn>
          )}
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!canSave} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : ing ? "Save" : "Add ingredient"}
          </Btn>
        </>
      }
    >
      <Field label="Name">
        <TextInput value={name} onChange={setName} placeholder="e.g. Oat milk" autoFocus={!ing} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" hint="g, ml, pcs…">
          <TextInput value={unit} onChange={(v) => setUnit(v.slice(0, 12))} />
        </Field>
        <Field label="Reorder at" hint="Shows as running low at or below this">
          <TextInput value={reorder} onChange={(v) => setReorder(num(v))} suffix={unit || undefined} mono inputMode="decimal" />
        </Field>
      </div>
      {!ing && (
        <Field label="Starting stock" hint="Later changes go through Adjust so history adds up">
          <TextInput value={stock} onChange={(v) => setStock(num(v))} suffix={unit || undefined} mono inputMode="decimal" />
        </Field>
      )}
      {ing && <div className="text-[12px] text-muted">Stock can&apos;t be edited here — use Adjust.</div>}
      {(save.isError || toggle.isError) && <ErrorNote>{errorText(save.error ?? toggle.error)}</ErrorNote>}
    </Sheet>
  );
}

export function Inventory() {
  const ingredients = useIngredients();
  const [view, setView] = useState<"all" | "low">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [adjust, setAdjust] = useState<Ingredient | null>(null);
  const [edit, setEdit] = useState<Ingredient | "new" | null>(null);

  return (
    <Loadable queries={[ingredients]}>
      {() => {
        const items = ingredients.data!.filter((i) => showInactive || i.is_active);
        // Same rule as /ingredient/low-stock: stock ≤ reorder level, lowest first
        const low = items
          .filter((i) => i.is_active && i.stock_quantity <= i.reorder_level)
          .sort((a, b) => a.stock_quantity / Math.max(a.reorder_level, 1) - b.stock_quantity / Math.max(b.reorder_level, 1));
        const rows = view === "low" ? low : items;
        return (
          <div className="scroll relative flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 sm:p-5 lg:p-[22px]" data-screen-label="Back office · Inventory">
            <PageHead
              title="Inventory"
              sub="Stock changes only through sales and adjustments, so history always adds up."
              right={
                <Btn kind="primary" size="sm" onClick={() => setEdit("new")}>
                  + Ingredient
                </Btn>
              }
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterChips
                value={view}
                onChange={setView}
                options={[
                  { value: "all" as const, label: "All", count: items.length },
                  { value: "low" as const, label: "Running low", count: low.length },
                ]}
              />
              <div className="flex-1" />
              <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <Toggle on={showInactive} onChange={setShowInactive} /> Show inactive
              </label>
            </div>
            <Table>
              <thead>
                <tr>
                  <th className={thCls}>Ingredient</th>
                  <th className={`${thCls} text-right`}>In stock</th>
                  <th className={`${thCls} hidden text-right sm:table-cell`}>Reorder at</th>
                  <th className={`${thCls} hidden md:table-cell`} />
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody key={view}>
                {rows.map((i) => {
                  const t = stockTone(i);
                  return (
                    <tr key={i.id} className="cursor-pointer" style={{ opacity: i.is_active ? 1 : 0.6 }} onClick={() => setEdit(i)}>
                      <td className={`${tdCls} font-medium`}>
                        <div className="flex flex-wrap items-center gap-2">
                          {i.name}
                          {!i.is_active && <Pill tone="INACTIVE">Inactive</Pill>}
                          {t && (
                            <span className="md:hidden">
                              <Pill tone={t}>{t === "NEG" ? "Negative" : "Low"}</Pill>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${tdCls} mono whitespace-nowrap text-right font-semibold`} style={{ color: i.stock_quantity < 0 ? "var(--persimmon-2)" : "var(--ink)" }}>
                        {qty(i.stock_quantity, i.unit)}
                      </td>
                      <td className={`${tdCls} mono hidden whitespace-nowrap text-right text-muted sm:table-cell`}>{qty(i.reorder_level, i.unit)}</td>
                      <td className={`${tdCls} hidden md:table-cell`}>{t && <Pill tone={t}>{t === "NEG" ? "Negative" : "Low"}</Pill>}</td>
                      <td className={`${tdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                        <Btn kind="secondary" size="sm" disabled={!i.is_active} onClick={() => setAdjust(i)}>
                          Adjust
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`${tdCls} py-8 text-center text-muted`}>
                      {view === "low" ? "Nothing is running low." : "No ingredients yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
            <div className="text-[12px] text-muted">Sales are never blocked by stock. Negative means more was sold than recorded — usually a missed restock. Tap a row to edit it.</div>
            {adjust && <AdjustSheet ing={adjust} onClose={() => setAdjust(null)} />}
            {edit && <IngredientSheet ing={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
          </div>
        );
      }}
    </Loadable>
  );
}
