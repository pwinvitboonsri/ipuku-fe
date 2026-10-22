"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { bahtText, parseBaht, useBoMutation, useProducts } from "@/lib/backoffice";
import { money } from "@/lib/format";
import type { LoyaltyCurrency, RewardRow, RewardType } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, Pill, Toggle } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { ItemPhoto } from "@/components/counter/item-photo";
import { Loadable, Select } from "../common";
import { PhotoField } from "../photo-field";
import { DateRange, OptionPicker, TargetPicker, dateToEndIso, dateToStartIso, int, isoToDate, keys, scheduleText } from "./shared";

const TYPES: { value: RewardType; label: string }[] = [
  { value: "FREE_ITEM", label: "Free item" },
  { value: "FIXED_DISCOUNT", label: "฿ off" },
  { value: "PERCENT_OFF", label: "% off" },
  { value: "FREE_OPTION", label: "Free option" },
  { value: "BUY_X_GET_Y", label: "Buy X get Y" },
];

export function rewardTypeText(r: RewardRow) {
  const capText = r.max_discount_satang ? ` (max ${money(r.max_discount_satang)})` : "";
  switch (r.type) {
    case "FIXED_DISCOUNT":
      return `${money(r.discount_satang ?? 0)} off`;
    case "FREE_ITEM":
      return `Free ${r.product?.name ?? "item"}${capText}`;
    case "PERCENT_OFF":
      return `${r.percent}% off${capText}`;
    case "FREE_OPTION":
      return `Free option${capText}`;
    case "BUY_X_GET_Y":
      return `Buy ${r.buy_qty} get ${r.get_qty} ${r.get_percent === 100 ? "free" : `${r.get_percent}% off`}${capText}`;
  }
}

function RewardSheet({ row, onClose }: { row: RewardRow | null; onClose: () => void }) {
  const products = useProducts();
  const [name, setName] = useState(row?.name ?? "");
  const [type, setType] = useState<RewardType>(row?.type ?? "FREE_ITEM");
  const [cost, setCost] = useState(row ? String(row.cost_points) : "");
  const [currency, setCurrency] = useState<LoyaltyCurrency>(row?.cost_currency ?? "POINTS");
  const [discount, setDiscount] = useState(row?.discount_satang ? bahtText(row.discount_satang) : "");
  const [productId, setProductId] = useState(row?.product?.id ?? "");
  const [maxDiscount, setMaxDiscount] = useState(row?.max_discount_satang ? bahtText(row.max_discount_satang) : "");
  const [percent, setPercent] = useState(row?.percent ? String(row.percent) : "");
  const [minSpend, setMinSpend] = useState(row?.min_spend_satang ? bahtText(row.min_spend_satang) : "");
  const [optionIds, setOptionIds] = useState<string[]>(row?.option_ids ?? []);
  const [productIds, setProductIds] = useState<string[]>(row?.product_ids ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(row?.category_ids ?? []);
  const [buy, setBuy] = useState(row?.buy_qty ? String(row.buy_qty) : "1");
  const [get, setGet] = useState(row?.get_qty ? String(row.get_qty) : "1");
  const [getPercent, setGetPercent] = useState(row?.get_percent ? String(row.get_percent) : "100");
  const [start, setStart] = useState(isoToDate(row?.starts_at ?? null));
  const [end, setEnd] = useState(isoToDate(row?.ends_at ?? null));
  const [combine, setCombine] = useState(row?.combine_with_promotions ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(row?.image_url ?? null);
  const [uploading, setUploading] = useState(false);

  const is = (...t: RewardType[]) => t.includes(type);
  const capSatang = maxDiscount ? parseBaht(maxDiscount) : null;
  const body = {
    name: name.trim(),
    type,
    cost_points: int(cost),
    cost_currency: currency,
    image_url: imageUrl,
    min_spend_satang: minSpend ? parseBaht(minSpend) : null,
    starts_at: dateToStartIso(start),
    ends_at: dateToEndIso(end),
    combine_with_promotions: combine,
    ...(is("FIXED_DISCOUNT") && { discount_satang: parseBaht(discount) }),
    ...(is("FREE_ITEM") && { product_id: productId, max_discount_satang: capSatang }),
    ...(is("PERCENT_OFF", "FREE_OPTION", "BUY_X_GET_Y") && { max_discount_satang: capSatang, product_ids: productIds, category_ids: categoryIds }),
    ...(is("PERCENT_OFF") && { percent: int(percent) }),
    ...(is("FREE_OPTION") && { option_ids: optionIds }),
    ...(is("BUY_X_GET_Y") && { buy_qty: int(buy), get_qty: int(get), get_percent: int(getPercent) }),
  };
  const typeOk =
    (is("FIXED_DISCOUNT") && (parseBaht(discount) ?? 0) >= 100) ||
    (is("FREE_ITEM") && !!productId && (capSatang ?? 0) >= 100) ||
    (is("PERCENT_OFF") && (int(percent) ?? 0) >= 1 && (int(percent) ?? 0) <= 100) ||
    (is("FREE_OPTION") && optionIds.length > 0) ||
    (is("BUY_X_GET_Y") && (int(buy) ?? 0) >= 1 && (int(get) ?? 0) >= 1 && (int(getPercent) ?? 0) >= 1);
  const ok = body.name && (body.cost_points ?? 0) >= 1 && typeOk;
  const save = useBoMutation(() => api.post(row ? `/loyalty/admin/rewards/${row.id}/update` : "/loyalty/admin/rewards/create", body), [keys.rewards], { onSuccess: onClose });

  const pick = (id: string) => {
    setProductId(id);
    const p = products.data?.find((x) => x.id === id);
    // default cap: the product's base price (a bigger size or extra options are paid by the customer)
    if (p && !maxDiscount) setMaxDiscount(bahtText(p.price_satang));
  };

  return (
    <Sheet
      title={row ? `Edit · ${row.name}` : "New reward"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!ok || save.isPending || uploading} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : row ? "Save" : "Create"}
          </Btn>
        </>
      }
    >
      <PhotoField id={row?.id ?? "new-reward"} name={name} value={imageUrl} onChange={setImageUrl} onBusy={setUploading} />
      <Field label="Name" hint="Customers see this in LINE">
        <TextInput value={name} onChange={setName} placeholder="e.g. Free Hojicha Latte" autoFocus={!row} />
      </Field>
      <Field label="Type">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`tap rounded-full border px-3 py-[6px] text-[12.5px] font-semibold ${type === t.value ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Costs">
          <TextInput value={cost} onChange={setCost} inputMode="numeric" mono />
        </Field>
        <Field label="Paid with">
          <Segmented<LoyaltyCurrency>
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "POINTS", label: "Points" },
              { value: "STAMPS", label: "Stamps" },
            ]}
          />
        </Field>
      </div>

      {is("FIXED_DISCOUNT") && (
        <Field label="Discount">
          <TextInput value={discount} onChange={setDiscount} inputMode="decimal" prefix="฿" mono />
        </Field>
      )}
      {is("FREE_ITEM") && (
        <Field label="Item" hint="Any size or options; the order must contain it">
          <Select value={productId} onChange={pick}>
            <option value="">Choose a product…</option>
            {(products.data ?? [])
              .filter((p) => p.is_active || p.id === productId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {money(p.price_satang)}
                </option>
              ))}
          </Select>
        </Field>
      )}
      {is("PERCENT_OFF") && (
        <Field label="Percent off">
          <TextInput value={percent} onChange={setPercent} inputMode="numeric" suffix="%" mono />
        </Field>
      )}
      {is("FREE_OPTION") && (
        <Field label="Free option" hint="One unit of any of these is free (e.g. the size-up on one drink)">
          <OptionPicker value={optionIds} onChange={setOptionIds} />
        </Field>
      )}
      {is("BUY_X_GET_Y") && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Buy">
            <TextInput value={buy} onChange={setBuy} inputMode="numeric" mono />
          </Field>
          <Field label="Get">
            <TextInput value={get} onChange={setGet} inputMode="numeric" mono />
          </Field>
          <Field label="… at % off">
            <TextInput value={getPercent} onChange={setGetPercent} inputMode="numeric" suffix="%" mono />
          </Field>
        </div>
      )}
      {is("PERCENT_OFF", "FREE_OPTION", "BUY_X_GET_Y") && (
        <Field label="Applies to" hint={is("BUY_X_GET_Y") ? "The cheapest matching items are the free ones." : undefined}>
          <TargetPicker productIds={productIds} categoryIds={categoryIds} onChange={(p, c) => (setProductIds(p), setCategoryIds(c))} />
        </Field>
      )}
      {!is("FIXED_DISCOUNT") && (
        <Field label={is("FREE_ITEM") ? "Max discount" : "Max discount (optional)"} hint="The most this reward takes off">
          <TextInput value={maxDiscount} onChange={setMaxDiscount} inputMode="decimal" prefix="฿" placeholder="no cap" mono />
        </Field>
      )}
      <Field label="Minimum order (optional)">
        <TextInput value={minSpend} onChange={setMinSpend} inputMode="decimal" prefix="฿" placeholder="none" mono />
      </Field>
      <Field label="Available (optional)" hint="Shown and redeemable only between these dates">
        <DateRange start={start} end={end} onChange={(s, e) => (setStart(s), setEnd(e))} />
      </Field>
      <div className="flex items-center justify-between gap-3 text-[13.5px]">
        <span>
          Can combine with store promotions
          <span className="block text-[12px] text-muted">Used when store promotions arrive (Phase 3).</span>
        </span>
        <Toggle on={combine} onChange={setCombine} />
      </div>
      <div className="text-[12px] text-muted">The discount is fixed here — baristas can&apos;t edit it. Codes customers already hold keep their old name and cost until they expire.</div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

export function RewardsTab() {
  const rewards = useQuery({ queryKey: keys.rewards, queryFn: () => api.get<RewardRow[]>("/loyalty/admin/rewards") });
  const [sheet, setSheet] = useState<{ row: RewardRow | null } | null>(null);
  const toggle = useBoMutation((r: RewardRow) => api.post(`/loyalty/admin/rewards/${r.id}/update-status`, { is_active: !r.is_active }), [keys.rewards]);

  return (
    <Loadable queries={[rewards]}>
      {() => (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">What members spend points or stamps on. Also used as welcome / birthday coupons.</span>
            <Btn kind="primary" size="sm" onClick={() => setSheet({ row: null })}>
              + New reward
            </Btn>
          </div>
          <Table minWidth={680}>
            <thead>
              <tr>
                <th className={thCls}>Reward</th>
                <th className={thCls}>Cost</th>
                <th className={thCls}>What it gives</th>
                <th className={thCls}>Available</th>
                <th className={thCls}>Status</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {rewards.data!.length === 0 && (
                <tr>
                  <td className={`${tdCls} text-muted`} colSpan={6}>
                    No rewards yet. Add one so members have something to collect for.
                  </td>
                </tr>
              )}
              {rewards.data!.map((r) => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2.5">
                      <ItemPhoto id={r.id} name={r.name} imageUrl={r.image_url ?? r.product?.image_url ?? null} size="line" />
                      <span className="font-semibold">{r.name}</span>
                    </div>
                  </td>
                  <td className={`${tdCls} mono whitespace-nowrap`}>
                    {r.cost_points} {r.cost_currency === "STAMPS" ? "stamps" : "pts"}
                  </td>
                  <td className={tdCls}>{rewardTypeText(r)}</td>
                  <td className={tdCls}>{r.starts_at || r.ends_at ? scheduleText({ weekdays: [], time_from: null, time_to: null, starts_at: r.starts_at, ends_at: r.ends_at }) : "Always"}</td>
                  <td className={tdCls}>{r.is_active ? <Pill tone="PAID">Active</Pill> : <Pill tone="INACTIVE">Inactive</Pill>}</td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex justify-end gap-1.5">
                      <Btn kind="ghost" size="sm" onClick={() => setSheet({ row: r })}>
                        Edit
                      </Btn>
                      <Btn kind={r.is_active ? "dangerSoft" : "secondary"} size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(r)}>
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {toggle.isError && <ErrorNote>{errorText(toggle.error)}</ErrorNote>}
          <div className="text-[12px] text-muted">Deactivating hides a reward in LINE; codes and coupons already issued still work until they expire.</div>
          {sheet && <RewardSheet row={sheet.row} onClose={() => setSheet(null)} />}
        </>
      )}
    </Loadable>
  );
}
