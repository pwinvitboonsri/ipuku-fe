"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { bahtText, parseBaht, useBoMutation } from "@/lib/backoffice";
import { clock, dateTime } from "@/lib/format";
import type { LoyaltyCurrency, LoyaltyMember, LoyaltyProgram, PointsActivity, PointsEntryType } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, PageHead, Pill, Spinner, labelCls } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { FilterChips, Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { Loadable, Select } from "./common";
import { EarnRulesTab } from "./loyalty/earn-rules";
import { PerksTab } from "./loyalty/perks";
import { RewardsTab } from "./loyalty/rewards";
import { int, keys } from "./loyalty/shared";

// Back office → Loyalty (loyalty design, Flow 5 + v2): base rule, earn rules, rewards, perks, members, activity log.

// ── Program: points rule

function RuleCard({ program }: { program: LoyaltyProgram }) {
  const [points, setPoints] = useState(String(program.points_per_unit));
  const [unit, setUnit] = useState(bahtText(program.unit_satang));
  const [hours, setHours] = useState(String(program.claim_valid_hours));
  const [minutes, setMinutes] = useState(String(program.reward_code_minutes));
  const next = { points_per_unit: int(points), unit_satang: parseBaht(unit), claim_valid_hours: int(hours), reward_code_minutes: int(minutes) };
  const changes = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== null && v !== program[k as keyof LoyaltyProgram]));
  // points per unit may be 0: no base points (e.g. a stamps-only program)
  const valid = Object.entries(next).every(([k, v]) => v !== null && (k === "points_per_unit" ? v >= 0 : v > 0));
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

function ProgramTab() {
  const program = useQuery({ queryKey: keys.program, queryFn: () => api.get<LoyaltyProgram>("/loyalty/admin/program") });
  return (
    <Loadable queries={[program]}>
      {() => (
        <>
          {!program.data!.claim_qr_enabled && (
            <ErrorNote>Receipt QR is off: LINE isn&apos;t fully set up on the server (LINE_ENABLED / LINE_LIFF_ID). Paid orders won&apos;t get a points QR until it is.</ErrorNote>
          )}
          <RuleCard key={program.data!.update_at} program={program.data!} />
          <div className="text-[12px] text-muted">Extra points (double days, happy hour, bonus items) and stamps are set in Earn rules.</div>
        </>
      )}
    </Loadable>
  );
}

// ── Members

// prefixes: refresh every search / filter
const MEMBERS_ALL = keys.members("").slice(0, 3);
const ACTIVITY_ALL = keys.activity("").slice(0, 3);

function AdjustSheet({ member, onClose }: { member: LoyaltyMember; onClose: () => void }) {
  const [currency, setCurrency] = useState<LoyaltyCurrency>("POINTS");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const n = /^-?\d+$/.test(amount.trim()) ? Number(amount.trim()) : 0;
  const save = useBoMutation(() => api.post(`/loyalty/admin/members/${member.id}/adjust`, { currency, amount: n, reason: reason.trim() }), [MEMBERS_ALL, ACTIVITY_ALL], {
    onSuccess: onClose,
  });
  return (
    <Sheet
      title={`Adjust · ${member.display_name ?? member.label}`}
      sub="A correction in the activity log, with your name and the reason. Use a minus sign to take away."
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!n || !reason.trim() || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : "Adjust"}
          </Btn>
        </>
      }
    >
      <Field label="Balance">
        <Segmented<LoyaltyCurrency>
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "POINTS", label: `Points (${member.balance})` },
            { value: "STAMPS", label: `Stamps (${member.stamps})` },
          ]}
        />
      </Field>
      <Field label="Amount" hint="e.g. 20 or -20">
        <TextInput value={amount} onChange={setAmount} inputMode="text" mono autoFocus />
      </Field>
      <Field label="Reason">
        <TextInput value={reason} onChange={(v) => setReason(v.slice(0, 255))} placeholder="e.g. Receipt lost, scanned for the customer" />
      </Field>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function BirthdaySheet({ member, onClose }: { member: LoyaltyMember; onClose: () => void }) {
  const [day, setDay] = useState(member.birthday ? String(member.birthday.day) : "");
  const [month, setMonth] = useState(member.birthday ? String(member.birthday.month) : "");
  const both = int(day) && int(month);
  const save = useBoMutation(
    (clear: boolean) => api.post(`/loyalty/admin/members/${member.id}/birthday`, clear ? { birth_day: null, birth_month: null } : { birth_day: int(day), birth_month: int(month) }),
    [MEMBERS_ALL],
    { onSuccess: onClose },
  );
  return (
    <Sheet
      title={`Birthday · ${member.display_name ?? member.label}`}
      sub="Members set it once when they join; only the owner can change it."
      onClose={onClose}
      footer={
        <>
          {member.birthday && (
            <Btn kind="dangerSoft" disabled={save.isPending} onClick={() => save.mutate(true)}>
              Clear
            </Btn>
          )}
          <Btn kind="primary" disabled={!both || save.isPending} onClick={() => save.mutate(false)}>
            Save
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day">
          <TextInput value={day} onChange={setDay} inputMode="numeric" mono />
        </Field>
        <Field label="Month">
          <Select value={month} onChange={setMonth}>
            <option value="">—</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

function MembersTab() {
  const [sheet, setSheet] = useState<{ kind: "adjust" | "birthday"; member: LoyaltyMember } | null>(null);
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
              <th className={`${thCls} text-right`}>Stamps</th>
              <th className={thCls}>Last visit</th>
              <th className={`${thCls} text-right`}>Visits</th>
              <th className={thCls}>Joined</th>
              <th className={thCls}>Birthday</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={`${tdCls} text-muted`} colSpan={9}>
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
                <td className={`${tdCls} mono text-right`}>{m.stamps}</td>
                <td className={tdCls}>{m.last_visit_at ? dateTime(m.last_visit_at) : "—"}</td>
                <td className={`${tdCls} mono text-right`}>{m.visits}</td>
                <td className={tdCls}>{new Date(m.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className={tdCls}>
                  <button type="button" className="tap underline decoration-line-2 underline-offset-2" onClick={() => setSheet({ kind: "birthday", member: m })}>
                    {m.birthday ? `${m.birthday.day} ${MONTHS[m.birthday.month - 1]}` : "—"}
                  </button>
                </td>
                <td className={`${tdCls} text-right`}>
                  <Btn kind="ghost" size="sm" onClick={() => setSheet({ kind: "adjust", member: m })}>
                    Adjust
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="text-[12px] text-muted">Name and photo come from the member&apos;s LINE profile. Balances are computed from the activity log; visits are receipts claimed.</div>
      {sheet?.kind === "adjust" && <AdjustSheet member={sheet.member} onClose={() => setSheet(null)} />}
      {sheet?.kind === "birthday" && <BirthdaySheet member={sheet.member} onClose={() => setSheet(null)} />}
    </>
  );
}

// ── Activity log (read-only ledger)

const TYPE_PILL: Record<PointsEntryType, { tone: "PAID" | "OPEN" | "REFUNDED" | "neutral" | "LOW"; label: string }> = {
  EARN: { tone: "PAID", label: "Earn" },
  REDEEM: { tone: "OPEN", label: "Redeem" },
  REVERSAL: { tone: "REFUNDED", label: "Reversal" },
  BONUS: { tone: "PAID", label: "Bonus" },
  ADJUST: { tone: "neutral", label: "Adjust" },
  EXPIRE: { tone: "LOW", label: "Expired" },
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
              { value: "BONUS", label: "Bonus" },
              { value: "ADJUST", label: "Adjust" },
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
                  {a.currency === "STAMPS" && <span className="ml-1 text-[11px] font-medium text-muted">stamps</span>}
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

type Tab = "program" | "earn" | "rewards" | "perks" | "members" | "activity";

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
          { value: "earn", label: "Earn rules" },
          { value: "rewards", label: "Rewards" },
          { value: "perks", label: "Perks" },
          { value: "members", label: "Members" },
          { value: "activity", label: "Activity log" },
        ]}
      />
      {tab === "program" ? (
        <ProgramTab />
      ) : tab === "earn" ? (
        <EarnRulesTab />
      ) : tab === "rewards" ? (
        <RewardsTab />
      ) : tab === "perks" ? (
        <PerksTab />
      ) : tab === "members" ? (
        <MembersTab />
      ) : (
        <ActivityTab />
      )}
    </div>
  );
}
