"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { bahtText, parseBaht, useBoMutation } from "@/lib/backoffice";
import { money } from "@/lib/format";
import type { EarnRule, EarnRuleKind, LoyaltyCurrency } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, Pill, Toggle, labelCls } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { Loadable } from "../common";
import { DateRange, TargetPicker, TimeRange, WeekdayPicker, dateToEndIso, dateToStartIso, int, isoToDate, keys, scheduleText } from "./shared";

// Earn rules on top of the base points per ฿: stamps per visit, ×N points, +N bonus — each with a schedule and filters

const KIND_LABEL: Record<EarnRuleKind, string> = { STAMPS_PER_VISIT: "Stamps", MULTIPLIER: "× Points", BONUS: "Bonus" };

function valueText(r: EarnRule) {
  if (r.kind === "MULTIPLIER") return `×${r.multiplier_x10 / 10} points${r.stackable ? " (stacks)" : ""}`;
  const unit = r.kind === "STAMPS_PER_VISIT" || r.currency === "STAMPS" ? "stamp" : "point";
  return `+${r.amount} ${unit}${r.amount === 1 ? "" : "s"}${r.per_item ? " per item" : " per order"}`;
}

function conditionText(r: EarnRule) {
  const parts: string[] = [];
  if (r.category_ids.length || r.product_ids.length) parts.push(`${r.category_ids.length + r.product_ids.length} item filter${r.category_ids.length + r.product_ids.length > 1 ? "s" : ""}`);
  if (r.min_spend_satang) parts.push(`spend ≥ ${money(r.min_spend_satang)}`);
  if (r.min_items) parts.push(`≥ ${r.min_items} items`);
  return parts.join(" · ") || "Any paid order";
}

function EarnRuleSheet({ row, onClose }: { row: EarnRule | null; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [kind, setKind] = useState<EarnRuleKind>(row?.kind ?? "MULTIPLIER");
  const [amount, setAmount] = useState(row ? String(row.amount || "") : "1");
  const [currency, setCurrency] = useState<LoyaltyCurrency>(row?.currency ?? "POINTS");
  const [multiplier, setMultiplier] = useState(row ? String(row.multiplier_x10 / 10) : "2");
  const [perItem, setPerItem] = useState(row?.per_item ?? false);
  const [minSpend, setMinSpend] = useState(row?.min_spend_satang ? bahtText(row.min_spend_satang) : "");
  const [minItems, setMinItems] = useState(row?.min_items ? String(row.min_items) : "");
  const [productIds, setProductIds] = useState<string[]>(row?.product_ids ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(row?.category_ids ?? []);
  const [weekdays, setWeekdays] = useState<number[]>(row?.weekdays ?? []);
  const [timeFrom, setTimeFrom] = useState<number | null>(row?.time_from ?? null);
  const [timeTo, setTimeTo] = useState<number | null>(row?.time_to ?? null);
  const [start, setStart] = useState(isoToDate(row?.starts_at ?? null));
  const [end, setEnd] = useState(isoToDate(row?.ends_at ?? null));
  const [stackable, setStackable] = useState(row?.stackable ?? false);

  const multi = kind === "MULTIPLIER";
  const x10 = Math.round(Number(multiplier) * 10);
  const body = {
    name: name.trim(),
    kind,
    ...(multi ? { multiplier_x10: x10, stackable } : { amount: int(amount) ?? 0, currency: kind === "STAMPS_PER_VISIT" ? "STAMPS" : currency, per_item: perItem }),
    min_spend_satang: minSpend ? (parseBaht(minSpend) ?? 0) : 0,
    min_items: int(minItems) ?? 0,
    product_ids: productIds,
    category_ids: categoryIds,
    weekdays,
    time_from: timeFrom,
    time_to: timeTo,
    starts_at: dateToStartIso(start),
    ends_at: dateToEndIso(end),
  };
  const timeOk = (timeFrom == null) === (timeTo == null);
  const ok = body.name && timeOk && (multi ? x10 >= 11 && x10 <= 100 : (int(amount) ?? 0) > 0);
  const save = useBoMutation(() => api.post(row ? `/loyalty/admin/earn-rules/${row.id}/update` : "/loyalty/admin/earn-rules/create", body), [keys.earnRules], { onSuccess: onClose });

  return (
    <Sheet
      title={row ? `Edit · ${row.name}` : "New earn rule"}
      sub="On top of the base points per ฿. Applies to orders paid while it's on."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!ok || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : row ? "Save" : "Create"}
          </Btn>
        </>
      }
    >
      <Field label="Name" hint="Customers see it in LINE, e.g. “ดับเบิลพอยต์วันจันทร์”">
        <TextInput value={name} onChange={setName} placeholder="e.g. Double points Monday" autoFocus={!row} />
      </Field>
      <Field label="Type">
        <Segmented<EarnRuleKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: "MULTIPLIER", label: "× Points" },
            { value: "BONUS", label: "+ Bonus" },
            { value: "STAMPS_PER_VISIT", label: "Stamps" },
          ]}
        />
      </Field>
      {multi ? (
        <>
          <Field label="Multiplier" hint="Of the points the order (or its matching items) earns. 2 = double.">
            <TextInput value={multiplier} onChange={setMultiplier} inputMode="decimal" prefix="×" mono />
          </Field>
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span>
              Stacks with other multipliers
              <span className="block text-[12px] text-muted">Off: only the best non-stacking multiplier counts.</span>
            </span>
            <Toggle on={stackable} onChange={setStackable} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={kind === "STAMPS_PER_VISIT" ? "Stamps" : "Amount"}>
              <TextInput value={amount} onChange={setAmount} inputMode="numeric" mono />
            </Field>
            {kind === "BONUS" && (
              <Field label="Gives">
                <Segmented<LoyaltyCurrency>
                  value={currency}
                  onChange={setCurrency}
                  options={[
                    { value: "POINTS", label: "Points" },
                    { value: "STAMPS", label: "Stamps" },
                  ]}
                />
              </Field>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span>
              Per matching item
              <span className="block text-[12px] text-muted">Off: once per order. On: e.g. 1 stamp per drink.</span>
            </span>
            <Toggle on={perItem} onChange={setPerItem} />
          </div>
        </>
      )}
      <Field label="Applies to">
        <TargetPicker productIds={productIds} categoryIds={categoryIds} onChange={(p, c) => (setProductIds(p), setCategoryIds(c))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minimum spend">
          <TextInput value={minSpend} onChange={setMinSpend} inputMode="decimal" prefix="฿" placeholder="none" mono />
        </Field>
        <Field label="Minimum matching items">
          <TextInput value={minItems} onChange={setMinItems} inputMode="numeric" placeholder="none" mono />
        </Field>
      </div>
      <span className={labelCls}>When (Thailand time)</span>
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      <TimeRange from={timeFrom} to={timeTo} onChange={(f, t) => (setTimeFrom(f), setTimeTo(t))} />
      {!timeOk && <div className="text-[12px] text-persimmon-2">Set both a start and an end time, or neither.</div>}
      <DateRange start={start} end={end} onChange={(s, e) => (setStart(s), setEnd(e))} />
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

export function EarnRulesTab() {
  const rules = useQuery({ queryKey: keys.earnRules, queryFn: () => api.get<EarnRule[]>("/loyalty/admin/earn-rules") });
  const [sheet, setSheet] = useState<{ row: EarnRule | null } | null>(null);
  const toggle = useBoMutation((r: EarnRule) => api.post(`/loyalty/admin/earn-rules/${r.id}/update-status`, { is_active: !r.is_active }), [keys.earnRules]);

  return (
    <Loadable queries={[rules]}>
      {() => (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">Double points days, happy-hour points, bonus on new items, stamps per visit or per drink.</span>
            <Btn kind="primary" size="sm" onClick={() => setSheet({ row: null })}>
              + New rule
            </Btn>
          </div>
          <Table minWidth={680}>
            <thead>
              <tr>
                <th className={thCls}>Rule</th>
                <th className={thCls}>Gives</th>
                <th className={thCls}>When</th>
                <th className={thCls}>Conditions</th>
                <th className={`${thCls} text-right`}>On</th>
              </tr>
            </thead>
            <tbody>
              {rules.data!.length === 0 && (
                <tr>
                  <td className={`${tdCls} text-muted`} colSpan={5}>
                    No extra rules — orders earn only the base points per ฿.
                  </td>
                </tr>
              )}
              {rules.data!.map((r) => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                  <td className={tdCls}>
                    <button type="button" className="tap text-left" onClick={() => setSheet({ row: r })}>
                      <b>{r.name}</b>
                      <span className="ml-2">
                        <Pill tone="neutral">{KIND_LABEL[r.kind]}</Pill>
                      </span>
                    </button>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>{valueText(r)}</td>
                  <td className={tdCls}>{scheduleText(r)}</td>
                  <td className={tdCls}>{conditionText(r)}</td>
                  <td className={`${tdCls} text-right`}>
                    <Toggle on={r.is_active} disabled={toggle.isPending} onChange={() => toggle.mutate(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {toggle.isError && <ErrorNote>{errorText(toggle.error)}</ErrorNote>}
          <div className="text-[12px] text-muted">Tap a rule to edit it. Changes apply to orders paid afterwards; points already on a receipt QR don&apos;t change.</div>
          {sheet && <EarnRuleSheet row={sheet.row} onClose={() => setSheet(null)} />}
        </>
      )}
    </Loadable>
  );
}
