"use client";

import { Btn } from "@/components/ui/btn";
import { Pill, labelCls } from "@/components/ui/bits";
import { qty } from "@/lib/format";
import { staffTone } from "@/lib/tone";
import {
  addDays,
  bkkDay,
  claimRate,
  daysAway,
  dayDiff,
  dow,
  memberName,
  memberNo,
  newMemberSeries,
  nfmt,
  pct,
  sales,
  sdiv,
  SEG_META,
  series,
  thb,
  thDate,
  TH_MON,
  type DashMember,
  type SegKey,
} from "@/lib/dashboard";
import { Avatar, BarChart, Delta, DivergingBars, DTable, EmptyNote, KpiCard, Meter, MiniStat, Panel, dGrid, type Col } from "./kit";
import type { DashCtx } from "./ctx";

// Dashboard tabs · Customers, Rewards, Stock

const AV = ["#A8B86C", "#C8553D", "#D4A537", "#6B7F4A", "#A06B3E", "#8A8378", "#3A332B", "#B8A968"];
export const memberColor = (m: DashMember) => AV[m.member_no % AV.length];

export function MemberCell({ m }: { m: DashMember }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={memberName(m)} color={memberColor(m)} src={m.picture_url} />
      <div className="flex min-w-0 flex-col leading-[1.2]">
        <span className="whitespace-nowrap font-medium">{memberName(m)}</span>
        <span className="mono whitespace-nowrap text-[11px] text-muted">{memberNo(m)}</span>
      </div>
    </div>
  );
}

export function lastVisitText(m: DashMember, now: Date) {
  if (!m.last_visit) return "No visit yet";
  const d = daysAway(m, now);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${thDate(bkkDay(m.last_visit))} · ${d}d`;
}

export const memberCols = (now: Date): Col<DashMember & { key: string }>[] => [
  { k: "m", label: "Member", render: (m) => <MemberCell m={m} /> },
  { k: "visits", label: "Visits", align: "right", mono: true, render: (m) => nfmt(m.visits) },
  { k: "spend", label: "Spend", align: "right", mono: true, render: (m) => thb(m.spend_satang) },
  { k: "last", label: "Last visit", render: (m) => <span className="whitespace-nowrap text-[12.5px] text-ink-2">{lastVisitText(m, now)}</span> },
  { k: "points", label: "Points", align: "right", mono: true, render: (m) => nfmt(m.points) },
];

export function DashCustomers({ c }: { c: DashCtx }) {
  const { D, r, cur, prev, compare, narrow, segs, age, now } = c;
  const ms = D.members;
  const rep = ms.filter((m) => m.visits >= 2);
  const memRev = cur.member_sales_satang;
  const nonRev = sales(cur) - memRev;
  const top = ms.filter((m) => m.spend_satang > 0).slice(0, 8);
  const month = Number(bkkDay(now).slice(5, 7));
  const bdays = ms.filter((m) => m.birth_month === month && m.birth_day).sort((a, b) => a.birth_day! - b.birth_day!);
  const cr = claimRate(cur);
  const gap = (m: DashMember) => (m.first_visit && m.last_visit ? dayDiff(bkkDay(m.first_visit), bkkDay(m.last_visit)) / (m.visits - 1) : 0);
  return (
    <>
      <div className="stagger" style={dGrid(narrow ? 2 : 4)}>
        <KpiCard label="LINE friends" value={nfmt(D.friends)} cur={D.friends} prev={D.prev_friends} compare={compare} foot={`+${nfmt(cur.new_friends)} in range`} />
        <KpiCard label="Members" value={nfmt(D.members_total)} cur={D.members_total} prev={D.prev_members_total} compare={compare} foot={D.friends ? `${pct(sdiv(D.members_total, D.friends))} of friends` : null} />
        <KpiCard label="New members" value={nfmt(cur.new_members)} cur={cur.new_members} prev={prev.new_members} compare={compare} onClick={() => c.drill({ type: "segment", seg: "new" })} />
        <KpiCard label="Unfollows" value={nfmt(cur.unfollows)} cur={cur.unfollows} prev={prev.unfollows} compare={compare} invert foot={D.friends ? `${pct(sdiv(cur.unfollows, D.friends), 1)} of friends` : null} />
      </div>
      <div style={dGrid(narrow ? 1 : 2)}>
        <Panel title="Receipt claim rate" sub="Share of walk-in receipts whose QR a member scanned">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="mono text-[34px] font-semibold tracking-[-0.6px]">{pct(cr)}</span>
            {compare && <Delta cur={cr} prev={claimRate(prev)} mode="pts" />}
            <span className="text-[12.5px] text-muted">
              <span className="mono">{nfmt(cur.claimed)}</span> of <span className="mono">{nfmt(cur.walk_orders)}</span> receipts
            </span>
          </div>
          {age < 7 ? (
            <EmptyNote title="Just getting started">Claim rate grows as customers scan receipts. Every paid walk-in order prints a QR — mention it at hand-off.</EmptyNote>
          ) : (
            <BarChart data={series(D, r, "claim", now)} fmt={(v) => pct(v)} compare={compare} height={110} color="var(--persimmon)" caption="Tap a day" />
          )}
        </Panel>
        <Panel title={r.len <= 14 ? "New members per day" : "New members per week"} sub="Weeks start Monday">
          {D.members_total < 1 ? (
            <EmptyNote title="No members yet">Members appear when a customer scans a receipt QR and joins via LINE.</EmptyNote>
          ) : (
            <BarChart data={newMemberSeries(D, r, now)} fmt={(v) => `${nfmt(v)} joined`} compare={compare && r.len <= 14} height={110} color="var(--matcha)" caption="Tap a bar" />
          )}
        </Panel>
      </div>
      <div style={dGrid(narrow ? 1 : 2)}>
        <Panel title="Members vs non-members" sub="Non-members include Grab and unclaimed receipts" pad={0}>
          <div className="h-3" />
          <DTable
            rows={[
              { key: "m", l: "Members", rev: memRev, ord: cur.claimed, c: "var(--persimmon)" },
              { key: "n", l: "Non-members", rev: nonRev, ord: cur.orders - cur.claimed, c: "var(--muted-2)" },
            ]}
            minWidth={420}
            cols={[
              {
                k: "l",
                label: "",
                render: (x) => (
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: x.c }} />
                    {x.l}
                  </span>
                ),
              },
              { k: "rev", label: "Revenue", align: "right", mono: true, render: (x) => thb(x.rev) },
              { k: "s", label: "Share", align: "right", mono: true, render: (x) => pct(sdiv(x.rev, memRev + nonRev)) },
              { k: "ord", label: "Orders", align: "right", mono: true, render: (x) => nfmt(x.ord) },
              { k: "avg", label: "Avg ticket", align: "right", mono: true, render: (x) => thb(sdiv(x.rev, x.ord)) },
            ]}
          />
        </Panel>
        <Panel title="Visit behaviour" asOf="All members">
          {age < 14 || rep.length === 0 ? (
            <EmptyNote title="Needs a couple of weeks">Repeat rate and time between visits show up once members come back.</EmptyNote>
          ) : (
            <div style={dGrid(3)}>
              <MiniStat label="Repeat rate" value={pct(sdiv(rep.length, ms.length))} sub="2+ visits" />
              <MiniStat label="Visits / member" value={sdiv(ms.reduce((s, m) => s + m.visits, 0), ms.length).toFixed(1)} />
              <MiniStat label="Days between" value={sdiv(rep.reduce((s, m) => s + gap(m), 0), rep.length).toFixed(0)} sub="average" />
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Segments" sub="Tap a group to see who's in it" asOf>
        <div className="stagger" style={dGrid(narrow ? 2 : 4, 10)}>
          {(Object.keys(SEG_META) as SegKey[]).map((k) => {
            const s = SEG_META[k];
            const wait = (k === "atRisk" && age < 30) || (k === "lapsed" && age < 60);
            return (
              <button key={k} type="button" onClick={() => c.drill({ type: "segment", seg: k })} className="tap flex flex-col gap-1.5 rounded-[12px] border border-line bg-paper px-3.5 py-3 text-left">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.tone }} />
                  {s.label}
                  <span className="ml-auto text-muted-2">›</span>
                </span>
                <span className="mono text-[26px] font-semibold" style={{ color: wait ? "var(--muted-2)" : "var(--ink)" }}>
                  {wait ? "—" : nfmt(segs[k].length)}
                </span>
                <span className="text-[11.5px] leading-[1.35] text-muted">{wait ? `Shows after ${k === "atRisk" ? 30 : 60} days of loyalty` : s.sub}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      <div style={{ ...dGrid(narrow ? 1 : 5), alignItems: "start" }}>
        <Panel title="Top members" sub="By total spend" asOf pad={0} style={{ gridColumn: narrow ? "auto" : "span 3" }}>
          <div className="h-3" />
          {top.length ? (
            <DTable rows={top.map((m) => ({ ...m, key: m.id }))} onRow={(m) => c.drill({ type: "member", m })} cols={memberCols(now)} minWidth={520} />
          ) : (
            <div className="p-4">
              <EmptyNote title="No member visits yet" />
            </div>
          )}
        </Panel>
        <Panel title={`Birthdays in ${TH_MON[month - 1]}`} sub="Birthday coupon status" style={{ gridColumn: narrow ? "auto" : "span 2" }}>
          {bdays.length === 0 ? (
            <EmptyNote title="No birthdays this month">Members can add their birthday when they join in LINE.</EmptyNote>
          ) : (
            <div className="flex flex-col">
              {bdays.slice(0, 8).map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 border-b border-line py-[7px]">
                  <span className="mono w-[56px] shrink-0 whitespace-nowrap text-[12px] text-muted">
                    {m.birth_day} {TH_MON[month - 1]}
                  </span>
                  <Avatar name={memberName(m)} color={memberColor(m)} src={m.picture_url} size={24} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{memberName(m)}</span>
                  {m.birthday_coupon === "USED" ? <Pill tone="PAID">Used</Pill> : m.birthday_coupon === "OPEN" ? <Pill tone="OPEN">Not used</Pill> : m.birthday_coupon === "EXPIRED" ? <Pill tone="INACTIVE">Expired</Pill> : <Pill>Not sent</Pill>}
                </div>
              ))}
              {bdays.length > 8 && <span className="pt-2 text-[12px] text-muted">+{bdays.length - 8} more</span>}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Cohort retention" sub="Members who joined in a month, and the share who came back in the months after" pad={0}>
        <div className="h-3" />
        {D.cohorts.length === 0 || age < 32 ? (
          <div className="px-4 pb-4">
            <EmptyNote title="Needs one full month of members">The first cohort row appears once members have had a month to return.</EmptyNote>
          </div>
        ) : (
          <DTable
            rows={D.cohorts.map((x) => ({ ...x, key: x.month }))}
            minWidth={460}
            cols={[
              { k: "mo", label: "Joined", render: (x) => <b className="font-semibold">{`${TH_MON[Number(x.month.slice(5)) - 1]} ${x.month.slice(0, 4)}`}</b> },
              { k: "n", label: "Members", align: "right", mono: true, render: (x) => nfmt(x.members) },
              ...[0, 1, 2].map((k) => ({
                k: `r${k}`,
                label: `Month ${k + 1}`,
                align: "center" as const,
                render: (x: { retention: (number | null)[] }) => {
                  const v = x.retention[k];
                  return v == null ? (
                    <span className="text-muted-2">—</span>
                  ) : (
                    <span
                      className="mono inline-block min-w-[54px] rounded-[6px] px-2 py-1 text-[12.5px] font-semibold"
                      style={{ background: `color-mix(in oklch, var(--matcha) ${Math.round(10 + v * 110)}%, var(--paper-2))`, color: v > 0.4 ? "#fff" : "var(--ink)" }}
                    >
                      {pct(v)}
                    </span>
                  );
                },
              })),
            ]}
          />
        )}
      </Panel>
    </>
  );
}

const TYPE_LABEL: Record<string, string> = { FIXED_DISCOUNT: "฿ off", PERCENT_OFF: "% off", FREE_ITEM: "Free item", FREE_OPTION: "Free option", BUY_X_GET_Y: "Buy X get Y" };
const SOURCE_LABEL = { WELCOME: "Welcome", BIRTHDAY: "Birthday", MANUAL: "Manual" } as const;

export function DashRewards({ c }: { c: DashCtx }) {
  const { D, r, cur, prev, compare, narrow } = c;
  const maxN = Math.max(1, ...D.rewards.map((x) => x.redemptions));
  const unit = D.program.unit_satang / 100;
  // rule days vs other days: for earn rules limited to some weekdays
  const inRange = Array.from({ length: r.len }, (_, i) => addDays(r.from, i));
  const net = (d: string) => D.days.find((x) => x.date === d)?.net_satang ?? 0;
  const avgOn = (days: string[]) => sdiv(days.reduce((t, d) => t + net(d), 0), days.length);
  const ruleRows = D.earn_lines.map((l) => {
    const rule = D.earn_rules.find((x) => x.name === l.label);
    const wd = rule?.weekdays ?? [];
    const on = wd.length && wd.length < 7 ? inRange.filter((d) => wd.includes(dow(d))) : [];
    const off = wd.length && wd.length < 7 ? inRange.filter((d) => !wd.includes(dow(d))) : [];
    return { key: l.label, ...l, on: on.length ? avgOn(on) : null, off: off.length ? avgOn(off) : null };
  });
  return (
    <>
      <div style={dGrid(narrow ? 1 : 2)}>
        <Panel title="Points" sub={`${D.program.points_per_unit} point${D.program.points_per_unit === 1 ? "" : "s"} per ฿${nfmt(unit)} spent`}>
          <div style={dGrid(3)}>
            <MiniStat label="Issued" value={nfmt(cur.points_issued)} sub="in range" />
            <MiniStat label="Redeemed" value={nfmt(cur.points_redeemed)} sub={`${pct(sdiv(cur.points_redeemed, cur.points_issued))} of issued`} />
            <MiniStat label="Outstanding" value={nfmt(D.points_outstanding)} sub="held by members" tone="neg" />
          </div>
          {compare && (
            <div className="flex items-center gap-2 text-[12px] text-muted">
              Issued vs previous <Delta cur={cur.points_issued} prev={prev.points_issued} />
            </div>
          )}
        </Panel>
        <Panel title="Stamps" sub="From stamp earn rules">
          {cur.stamps_issued + D.stamps_outstanding === 0 ? (
            <EmptyNote title="No stamps yet">Add a stamps rule in Loyalty → Earn rules to start a stamp card.</EmptyNote>
          ) : (
            <div style={dGrid(3)}>
              <MiniStat label="Issued" value={nfmt(cur.stamps_issued)} />
              <MiniStat label="Redeemed" value={nfmt(cur.stamps_redeemed)} />
              <MiniStat label="Outstanding" value={nfmt(D.stamps_outstanding)} sub="held by members" tone="neg" />
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Rewards redeemed" sub="Most popular first · discount is what the shop gave up" pad={0}>
        <div className="h-3" />
        {D.rewards.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyNote title="No redemptions in this range">Members need a few visits to collect enough points. The first ones usually show up in week two.</EmptyNote>
          </div>
        ) : (
          <DTable
            rows={D.rewards.map((x) => ({ ...x, key: x.reward_id }))}
            minWidth={600}
            cols={[
              { k: "name", label: "Reward", render: (x) => <span className="font-semibold">{x.name}</span> },
              { k: "type", label: "Type", render: (x) => <Pill>{TYPE_LABEL[x.type] ?? x.type}</Pill> },
              { k: "cost", label: "Cost", mono: true, render: (x) => <span className="text-[12.5px] text-ink-2">{`${nfmt(x.cost_points)} ${x.cost_currency === "STAMPS" ? "stamps" : "pts"}`}</span> },
              {
                k: "bar",
                label: "Redemptions",
                w: narrow ? 120 : 200,
                render: (x) => (
                  <div className="flex items-center gap-2.5">
                    <Meter v={x.redemptions} max={maxN} color="var(--persimmon)" />
                    <span className="mono w-8 text-right font-semibold">{x.redemptions}</span>
                  </div>
                ),
              },
              { k: "d", label: "Discount", align: "right", mono: true, render: (x) => thb(x.discount_satang) },
            ]}
          />
        )}
      </Panel>
      <div style={dGrid(narrow ? 1 : 2)}>
        <Panel title="Coupons by source" sub={`Issued in range · coupon discounts ${thb(D.coupon_discount_satang)}`}>
          {D.coupons.every((k) => k.issued === 0) ? (
            <EmptyNote title="No coupons issued in this range">Welcome and birthday perks hand out coupons automatically.</EmptyNote>
          ) : (
            <>
              {D.coupons.map((k) => (
                <div key={k.source} className="flex flex-col gap-1.5">
                  <div className="flex gap-2 text-[13px]">
                    <b className="flex-1 font-semibold">{SOURCE_LABEL[k.source]}</b>
                    <span className="mono text-[12px] text-muted">
                      {nfmt(k.issued)} issued · {pct(sdiv(k.used, k.issued))} used
                    </span>
                  </div>
                  <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-paper-2">
                    {k.used > 0 && <div style={{ flexGrow: k.used, flexBasis: 0, background: "var(--matcha)" }} />}
                    {k.open > 0 && <div style={{ flexGrow: k.open, flexBasis: 0, background: "var(--line-2)" }} />}
                    {k.expired > 0 && <div style={{ flexGrow: k.expired, flexBasis: 0, background: "var(--persimmon)", opacity: 0.6 }} />}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3.5 text-[11.5px] text-muted">
                {[
                  ["Used", "var(--matcha)"],
                  ["Still open", "var(--line-2)"],
                  ["Expired", "rgba(200,85,61,.6)"],
                ].map(([l, col]) => (
                  <span key={l} className="flex items-center gap-1.5">
                    <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: col }} />
                    {l}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>
        <Panel title="Earn rules" sub="Extra points and stamps each rule gave on claimed receipts" pad={0}>
          <div className="h-3" />
          {ruleRows.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyNote title="No extra points given in this range">Double-points days, happy hours and stamp rules show here once receipts are claimed.</EmptyNote>
            </div>
          ) : (
            <DTable
              rows={ruleRows}
              minWidth={420}
              cols={[
                { k: "l", label: "Rule", render: (x) => <span className="font-semibold">{x.label}</span> },
                { k: "x", label: "Extra given", align: "right", mono: true, render: (x) => [x.points && `${nfmt(x.points)} pts`, x.stamps && `${nfmt(x.stamps)} stamps`].filter(Boolean).join(" · ") },
                {
                  k: "on",
                  label: "Avg day",
                  align: "right",
                  render: (x) =>
                    x.on == null || x.off == null ? (
                      <span className="text-muted-2">—</span>
                    ) : (
                      <span className="flex flex-col items-end gap-[3px]">
                        <span className="mono">{thb(x.on)}</span>
                        <span className="text-[11px] text-muted">
                          vs {thb(x.off)} other days <Delta cur={x.on} prev={x.off} />
                        </span>
                      </span>
                    ),
                },
              ]}
            />
          )}
        </Panel>
      </div>
    </>
  );
}

export function DashStock({ c }: { c: DashCtx }) {
  const { D, r, cur, compare, narrow, low, now } = c;
  const lowSorted = [...low].sort((a, b) => sdiv(a.stock_quantity, a.reorder_level) - sdiv(b.stock_quantity, b.reorder_level));
  const maxW = Math.max(1, ...D.waste.map((w) => w.entries));
  const shifts = D.shifts.map((s) => ({ full: `${thDate(bkkDay(s.close_at))}`, v: s.variance_satang ?? 0, sub: s.close_by_staff ? `${s.close_by_staff.name} closed` : undefined }));
  const short = shifts.filter((s) => s.v < 0);
  return (
    <>
      <div style={{ ...dGrid(narrow ? 1 : 2), alignItems: "start" }}>
        <Panel
          title="Low stock"
          sub="At or below reorder level"
          asOf
          pad={0}
          right={
            <Btn kind="ghost" size="sm" onClick={() => c.go("/backoffice/inventory")}>
              Inventory ›
            </Btn>
          }
        >
          <div className="h-3" />
          {lowSorted.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyNote title="All stocked">Nothing is at or below its reorder level.</EmptyNote>
            </div>
          ) : (
            <DTable
              rows={lowSorted.map((i) => ({ ...i, key: i.id }))}
              minWidth={380}
              cols={[
                { k: "name", label: "Ingredient", render: (i) => <span className="font-medium">{i.name}</span> },
                { k: "stock", label: "In stock", align: "right", mono: true, render: (i) => <span style={{ color: i.stock_quantity < 0 ? "var(--persimmon-2)" : "var(--ink)", fontWeight: 600 }}>{qty(i.stock_quantity, i.unit)}</span> },
                { k: "r", label: "Reorder", align: "right", mono: true, render: (i) => <span className="text-muted">{qty(i.reorder_level, i.unit)}</span> },
                { k: "t", label: "", render: (i) => <Pill tone={i.stock_quantity < 0 ? "NEG" : "LOW"}>{i.stock_quantity < 0 ? "Negative" : "Low"}</Pill> },
              ]}
            />
          )}
        </Panel>
        <Panel title="Waste" sub={`${nfmt(cur.waste_entries)} waste entr${cur.waste_entries === 1 ? "y" : "ies"} in range`}>
          <BarChart data={series(D, r, "waste", now)} fmt={(v) => `${nfmt(v)} entries`} compare={compare} height={90} color="var(--persimmon-2)" caption="Tap a day" />
          <span className={labelCls}>Most wasted</span>
          {D.waste.length === 0 ? (
            <EmptyNote title="No waste logged">Log spills and expired stock from Inventory → Adjust → Waste.</EmptyNote>
          ) : (
            D.waste.slice(0, 5).map((w) => (
              <div key={w.ingredient_id} className="flex items-center gap-2.5 text-[13px]">
                <span className="w-[150px] min-w-0 truncate">{w.name}</span>
                <Meter v={w.entries} max={maxW} color="var(--persimmon-2)" />
                <span className="mono w-[78px] text-right text-[12.5px]">{qty(w.quantity, w.unit)}</span>
              </div>
            ))
          )}
        </Panel>
      </div>
      <Panel title="Staff" sub="Who rang up the paid orders · voids and refunds by who did them" pad={0}>
        <div className="h-3" />
        {D.staff.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyNote title="No orders in this range" />
          </div>
        ) : (
          <DTable
            rows={D.staff.map((s) => ({ ...s, key: s.staff_id }))}
            minWidth={560}
            cols={[
              {
                k: "n",
                label: "Staff",
                render: (s) => (
                  <span className="flex items-center gap-2.5 font-medium">
                    <Avatar name={s.name} color={staffTone(s.staff_id)} size={26} />
                    {s.name}
                  </span>
                ),
              },
              { k: "orders", label: "Orders", align: "right", mono: true, render: (s) => nfmt(s.paid_orders) },
              { k: "net", label: "Net sales", align: "right", mono: true, render: (s) => thb(s.net_sales_satang) },
              { k: "avg", label: "Avg ticket", align: "right", mono: true, render: (s) => thb(sdiv(s.net_sales_satang, s.paid_orders)) },
              { k: "voids", label: "Voids", align: "right", mono: true, render: (s) => nfmt(s.voids) },
              { k: "refunds", label: "Refunds", align: "right", mono: true, render: (s) => (s.refunds ? <span className="font-semibold text-persimmon-2">{nfmt(s.refunds)}</span> : "0") },
            ]}
          />
        )}
      </Panel>
      <Panel
        title="Cash variance per shift"
        sub={shifts.length ? `${short.length} of ${shifts.length} shift${shifts.length === 1 ? "" : "s"} short · total ${thb(shifts.reduce((s, x) => s + x.v, 0))}` : null}
        right={
          <Btn kind="ghost" size="sm" onClick={() => c.go("/backoffice/shifts")}>
            Shifts ›
          </Btn>
        }
      >
        {shifts.length === 0 ? <EmptyNote title="No closed shifts in this range">Variance appears once a shift is closed and the drawer counted.</EmptyNote> : <DivergingBars data={shifts} />}
      </Panel>
    </>
  );
}
