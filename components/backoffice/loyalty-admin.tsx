"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { bahtText, bo, parseBaht, useBoMutation, useProducts } from "@/lib/backoffice";
import { clock, dateTime, money } from "@/lib/format";
import type { LoyaltyMember, LoyaltyProgram, PointsActivity, PointsEntryType, RewardRow, RewardType } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, PageHead, Pill, Spinner, labelCls } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { FilterChips, Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { ItemPhoto } from "@/components/counter/item-photo";
import { Loadable, Select } from "./common";
import { PhotoField } from "./photo-field";

// Back office → Loyalty (loyalty design, Flow 5): points rule + rewards, members, read-only activity log.

const keys = {
  program: [...bo.loyalty, "program"] as const,
  rewards: [...bo.loyalty, "rewards"] as const,
  members: (q: string) => [...bo.loyalty, "members", q] as const,
  activity: (t: string) => [...bo.loyalty, "activity", t] as const,
};

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

function rewardTypeText(r: RewardRow) {
  return r.type === "FIXED_DISCOUNT"
    ? `Fixed ${money(r.discount_satang ?? 0)} off`
    : `Free item · ${r.product?.name ?? "—"}${r.max_discount_satang ? ` (max ${money(r.max_discount_satang)})` : ""}`;
}

// ── Program: points rule

function RuleCard({ program }: { program: LoyaltyProgram }) {
  const [points, setPoints] = useState(String(program.points_per_unit));
  const [unit, setUnit] = useState(bahtText(program.unit_satang));
  const [hours, setHours] = useState(String(program.claim_valid_hours));
  const [minutes, setMinutes] = useState(String(program.reward_code_minutes));
  const next = { points_per_unit: int(points), unit_satang: parseBaht(unit), claim_valid_hours: int(hours), reward_code_minutes: int(minutes) };
  const changes = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== null && v !== program[k as keyof LoyaltyProgram]));
  const valid = Object.values(next).every((v) => v !== null && v > 0);
  const save = useBoMutation(() => api.post<LoyaltyProgram>("/loyalty/admin/program/update", changes), [keys.program]);
  const example = valid ? Math.floor(14500 / next.unit_satang!) * next.points_per_unit! : null;

  return (
    <Card pad={16} className="flex flex-col gap-3">
      <span className={labelCls}>Points rule</span>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 text-[13.5px]">
        <div className="flex items-center gap-2">
          Earn
          <div className="w-[70px]">
            <TextInput value={points} onChange={setPoints} inputMode="numeric" mono />
          </div>
          pt per
          <div className="w-[96px]">
            <TextInput value={unit} onChange={setUnit} inputMode="decimal" prefix="฿" mono />
          </div>
        </div>
        <span className="text-muted">
          Round <b className="text-ink">down</b>
          {example !== null && <span className="mono"> (฿145 → {example})</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-3 text-[13.5px]">
        <div className="flex items-center gap-2">
          Receipt QR valid
          <div className="w-[80px]">
            <TextInput value={hours} onChange={setHours} inputMode="numeric" suffix="h" mono />
          </div>
        </div>
        <div className="flex items-center gap-2">
          Reward code valid
          <div className="w-[86px]">
            <TextInput value={minutes} onChange={setMinutes} inputMode="numeric" suffix="min" mono />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] text-muted">Changes apply to orders paid after saving. Points already issued stay as they are.</span>
        <Btn kind="primary" size="sm" disabled={!valid || !Object.keys(changes).length || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending ? "Saving…" : "Save rule"}
        </Btn>
      </div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Card>
  );
}

// ── Program: reward sheet (create / edit)

function RewardSheet({ row, onClose }: { row: RewardRow | null; onClose: () => void }) {
  const products = useProducts();
  const [name, setName] = useState(row?.name ?? "");
  const [cost, setCost] = useState(row ? String(row.cost_points) : "");
  const [type, setType] = useState<RewardType>(row?.type ?? "FREE_ITEM");
  const [discount, setDiscount] = useState(row?.discount_satang ? bahtText(row.discount_satang) : "");
  const [productId, setProductId] = useState(row?.product?.id ?? "");
  const [maxDiscount, setMaxDiscount] = useState(row?.max_discount_satang ? bahtText(row.max_discount_satang) : "");
  const [imageUrl, setImageUrl] = useState<string | null>(row?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fixed = type === "FIXED_DISCOUNT";

  const discountSatang = parseBaht(discount);
  const maxSatang = parseBaht(maxDiscount);
  const body = {
    name: name.trim(),
    cost_points: int(cost),
    type,
    image_url: imageUrl,
    ...(fixed ? { discount_satang: discountSatang } : { product_id: productId, max_discount_satang: maxSatang }),
  };
  const ok = body.name && body.cost_points && (fixed ? (discountSatang ?? 0) >= 100 : productId && (maxSatang ?? 0) >= 100);
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
      {!imageUrl && !fixed && productId && <div className="-mt-2 text-[12px] text-muted">No photo: LINE shows the product&apos;s photo.</div>}
      <Field label="Name" hint="Customers see this in LINE">
        <TextInput value={name} onChange={setName} placeholder="e.g. Free Hojicha Latte" autoFocus={!row} />
      </Field>
      <Field label="Points cost">
        <TextInput value={cost} onChange={setCost} inputMode="numeric" suffix="pts" mono />
      </Field>
      <Field label="Type">
        <Segmented<RewardType>
          value={type}
          onChange={setType}
          options={[
            { value: "FREE_ITEM", label: "Free item" },
            { value: "FIXED_DISCOUNT", label: "Fixed ฿ off" },
          ]}
        />
      </Field>
      {fixed ? (
        <Field label="Discount">
          <TextInput value={discount} onChange={setDiscount} inputMode="decimal" prefix="฿" mono />
        </Field>
      ) : (
        <>
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
          <Field label="Max discount" hint="The most this reward takes off (e.g. the regular size's price)">
            <TextInput value={maxDiscount} onChange={setMaxDiscount} inputMode="decimal" prefix="฿" mono />
          </Field>
        </>
      )}
      <div className="text-[12px] text-muted">Discount is fixed here — baristas can&apos;t edit it at the counter. Codes customers already hold keep their old name and cost until they expire.</div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

function ProgramTab() {
  const program = useQuery({ queryKey: keys.program, queryFn: () => api.get<LoyaltyProgram>("/loyalty/admin/program") });
  const rewards = useQuery({ queryKey: keys.rewards, queryFn: () => api.get<RewardRow[]>("/loyalty/admin/rewards") });
  const [sheet, setSheet] = useState<{ row: RewardRow | null } | null>(null);
  const toggle = useBoMutation((r: RewardRow) => api.post(`/loyalty/admin/rewards/${r.id}/update-status`, { is_active: !r.is_active }), [keys.rewards]);

  return (
    <Loadable queries={[program, rewards]}>
      {() => (
        <>
          {!program.data!.claim_qr_enabled && (
            <ErrorNote>Receipt QR is off: LINE isn&apos;t fully set up on the server (LINE_ENABLED / LINE_LIFF_ID). Paid orders won&apos;t get a points QR until it is.</ErrorNote>
          )}
          <RuleCard key={program.data!.update_at} program={program.data!} />
          <div className="flex items-center justify-between gap-3">
            <span className={labelCls}>Rewards</span>
            <Btn kind="primary" size="sm" onClick={() => setSheet({ row: null })}>
              + New reward
            </Btn>
          </div>
          <Table minWidth={560}>
            <thead>
              <tr>
                <th className={thCls}>Reward</th>
                <th className={thCls}>Cost</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Status</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {rewards.data!.length === 0 && (
                <tr>
                  <td className={`${tdCls} text-muted`} colSpan={5}>
                    No rewards yet. Add one so members have something to collect points for.
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
                  <td className={`${tdCls} mono`}>{r.cost_points} pts</td>
                  <td className={tdCls}>{rewardTypeText(r)}</td>
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
          <div className="text-[12px] text-muted">Deactivating hides a reward in LINE; codes already issued still work until they expire.</div>
          {sheet && <RewardSheet row={sheet.row} onClose={() => setSheet(null)} />}
        </>
      )}
    </Loadable>
  );
}

// ── Members

function MembersTab() {
  const [q, setQ] = useState("");
  const query = q.trim();
  const members = useQuery({
    queryKey: keys.members(query),
    queryFn: () => api.list<LoyaltyMember[]>("/loyalty/admin/members", query ? { q: query } : {}),
    placeholderData: (prev) => prev,
  });
  const rows = members.data?.data ?? [];
  const total = typeof members.data?.meta?.total === "number" ? members.data.meta.total : rows.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[14px] font-semibold">
          Members <span className="mono text-[12px] text-muted">{total.toLocaleString()}</span>
        </span>
        <div className="ml-auto w-full max-w-[260px]">
          <TextInput value={q} onChange={setQ} placeholder="Search name or IPK number" prefix="⌕" />
        </div>
      </div>
      {members.isPending ? (
        <Spinner />
      ) : members.isError ? (
        <ErrorNote>{errorText(members.error)}</ErrorNote>
      ) : (
        <Table minWidth={620}>
          <thead>
            <tr>
              <th className={thCls}>Member</th>
              <th className={thCls}>ID</th>
              <th className={`${thCls} text-right`}>Points</th>
              <th className={thCls}>Last visit</th>
              <th className={`${thCls} text-right`}>Visits</th>
              <th className={thCls}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={`${tdCls} text-muted`} colSpan={6}>
                  {query ? "No members match." : "No members yet. Customers join from the shop's LINE OA."}
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id}>
                <td className={tdCls}>
                  <div className="flex items-center gap-2.5">
                    {m.picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- LINE profile photo
                      <img src={m.picture_url} alt="" className="h-[26px] w-[26px] rounded-full object-cover" />
                    ) : (
                      <div className="h-[26px] w-[26px] rounded-full bg-paper-3" />
                    )}
                    <b>{m.display_name ?? "—"}</b>
                  </div>
                </td>
                <td className={`${tdCls} mono`}>{m.label}</td>
                <td className={`${tdCls} mono text-right font-semibold ${m.balance < 0 ? "text-persimmon-2" : ""}`}>{m.balance}</td>
                <td className={tdCls}>{m.last_visit_at ? dateTime(m.last_visit_at) : "—"}</td>
                <td className={`${tdCls} mono text-right`}>{m.visits}</td>
                <td className={tdCls}>{new Date(m.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="text-[12px] text-muted">Name and photo come from the member&apos;s LINE profile. Balance is computed from the activity log; visits are receipts claimed.</div>
    </>
  );
}

// ── Activity log (read-only ledger)

const TYPE_PILL: Record<PointsEntryType, { tone: "PAID" | "OPEN" | "REFUNDED"; label: string }> = {
  EARN: { tone: "PAID", label: "Earn" },
  REDEEM: { tone: "OPEN", label: "Redeem" },
  REVERSAL: { tone: "REFUNDED", label: "Reversal" },
};

function ActivityTab() {
  const [type, setType] = useState<"ALL" | PointsEntryType>("ALL");
  const activity = useQuery({
    queryKey: keys.activity(type),
    queryFn: () => api.get<PointsActivity[]>("/loyalty/admin/activity", type === "ALL" ? {} : { type }),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[14px] font-semibold">Points activity</span>
        <div className="ml-auto">
          <FilterChips
            value={type}
            onChange={setType}
            options={[
              { value: "ALL", label: "All" },
              { value: "EARN", label: "Earn" },
              { value: "REDEEM", label: "Redeem" },
              { value: "REVERSAL", label: "Reversal" },
            ]}
          />
        </div>
      </div>
      {activity.isPending ? (
        <Spinner />
      ) : activity.isError ? (
        <ErrorNote>{errorText(activity.error)}</ErrorNote>
      ) : (
        <Table minWidth={620}>
          <thead>
            <tr>
              <th className={thCls}>Time</th>
              <th className={thCls}>Member</th>
              <th className={thCls}>Type</th>
              <th className={`${thCls} text-right`}>Points</th>
              <th className={thCls}>Reference</th>
              <th className={thCls}>By</th>
            </tr>
          </thead>
          <tbody>
            {activity.data!.length === 0 && (
              <tr>
                <td className={`${tdCls} text-muted`} colSpan={6}>
                  Nothing yet.
                </td>
              </tr>
            )}
            {activity.data!.map((a) => (
              <tr key={a.id}>
                <td className={`${tdCls} mono whitespace-nowrap`} title={dateTime(a.create_at)}>
                  {clock(a.create_at)}
                </td>
                <td className={tdCls}>
                  {a.member.display_name ?? "—"} <span className="mono text-[11.5px] text-muted">{a.member.label}</span>
                </td>
                <td className={tdCls}>
                  <Pill tone={TYPE_PILL[a.type].tone}>{TYPE_PILL[a.type].label}</Pill>
                </td>
                <td className={`${tdCls} mono text-right font-semibold`} style={{ color: a.points >= 0 ? "var(--matcha)" : "var(--persimmon-2)" }}>
                  {a.points > 0 ? `+${a.points}` : a.points}
                </td>
                <td className={tdCls}>{a.note ?? (a.order_number ? `#${a.order_number}` : "—")}</td>
                <td className={tdCls}>{a.by}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="text-[12px] text-muted">Read-only ledger. To correct points, refund the source order.</div>
    </>
  );
}

type Tab = "program" | "members" | "activity";

export function LoyaltyAdmin() {
  const [tab, setTab] = useState<Tab>("program");
  return (
    <div className="scroll relative flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 sm:p-5 lg:p-[22px]" data-screen-label="Back office · Loyalty">
      <PageHead title="Loyalty" sub="LINE points and rewards. Customers join and collect in the shop's LINE OA." />
      <FilterChips<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "program", label: "Program" },
          { value: "members", label: "Members" },
          { value: "activity", label: "Activity log" },
        ]}
      />
      {tab === "program" ? <ProgramTab /> : tab === "members" ? <MembersTab /> : <ActivityTab />}
    </div>
  );
}
