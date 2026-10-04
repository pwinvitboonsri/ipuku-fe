"use client";

import { useState } from "react";
import { errorText } from "@/lib/api";
import { useShifts, useStaffAdmin } from "@/lib/backoffice";
import { clock, money, shortDate } from "@/lib/format";
import { useShiftReport } from "@/lib/reports";
import { useCurrentShift } from "@/lib/session";
import type { CashSession } from "@/lib/types";
import { Card, PageHead, Pill, Spinner } from "@/components/ui/bits";
import { ShiftReport } from "@/components/report/shift-report";
import { inputCls } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { Loadable } from "./common";

const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const signed = (v: number) => (v === 0 ? "0.00" : (v > 0 ? "+" : "") + money(v));
const tone = (v: number) => (v < 0 ? "var(--persimmon-2)" : v > 0 ? "var(--matcha)" : "var(--muted)");

function ShiftSheet({ s, onClose }: { s: CashSession; onClose: () => void }) {
  const report = useShiftReport(s.id, !!s.close_at);
  return (
    <Sheet title={`Shift · ${shortDate(s.open_at)}`} sub={s.close_at ? "Closed shift report" : "Live — shift still open"} width={640} onClose={onClose}>
      {report.isPending && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {report.isError && <div className="text-[13px] text-persimmon-2">{errorText(report.error)}</div>}
      {report.isSuccess && <ShiftReport report={report.data} />}
    </Sheet>
  );
}

export function Shifts() {
  const current = useCurrentShift();
  const staff = useStaffAdmin();
  const [from, setFrom] = useState(() => dayStr(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => dayStr(new Date()));
  const [sel, setSel] = useState<CashSession | null>(null);
  // before is required by the API; include the whole "to" day
  const shifts = useShifts({ before: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString(), after: new Date(`${from}T00:00:00`).toISOString() });
  const names = (id?: string | null) => (id ? staff.data?.find((s) => s.id === id)?.name : undefined);
  const cur = current.data;

  return (
    <div className="scroll flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 sm:p-5 lg:p-[22px]" data-noshrink="1" data-screen-label="Back office · Shifts">
      <PageHead title="Shifts" sub="Past cash sessions — tap one for its sales report. Variance = counted − (float + cash taken − cash refunded)." />
      {cur && (
        <button type="button" onClick={() => setSel(cur)} className="tap text-left">
          <Card className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 p-3.5">
            <Pill tone="OPEN">Open now</Pill>
            <span className="text-[13.5px]">
              {shortDate(cur.open_at)} · opened {clock(cur.open_at)}
              {names(cur.opened_by_staff_id) ? ` by ${names(cur.opened_by_staff_id)}` : ""} · float <span className="mono">{money(cur.opening_float_satang)}</span>
            </span>
          </Card>
        </button>
      )}
      <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} !w-auto !py-2 !text-[13px]`} aria-label="From" />
        –
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${inputCls} !w-auto !py-2 !text-[13px]`} aria-label="To" />
      </div>
      <Loadable queries={[shifts]}>
        {() => {
          const past = shifts.data!.filter((s) => s.close_at);
          return (
            <Table minWidth={880}>
              <thead>
                <tr>
                  {["Date", "Open – close", "Opened / closed by", "Orders", "Net sales", "Float", "Expected", "Counted", "Variance"].map((h, i) => (
                    <th key={h} className={`${thCls} ${i >= 3 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {past.map((s) => {
                  const v = s.variance_satang ?? 0;
                  const by = names(s.opened_by_staff_id) ?? "—";
                  const closedBy = names(s.close_by_staff_id);
                  return (
                    <tr key={s.id} onClick={() => setSel(s)} className="cursor-pointer" style={{ background: sel?.id === s.id ? "var(--paper-2)" : "transparent" }}>
                      <td className={`${tdCls} whitespace-nowrap font-medium`}>{shortDate(s.open_at)}</td>
                      <td className={`${tdCls} mono whitespace-nowrap text-ink-2`}>
                        {clock(s.open_at)}–{clock(s.close_at)}
                      </td>
                      <td className={`${tdCls} text-[12.5px] text-ink-2`}>
                        {by}
                        {closedBy && closedBy !== by ? ` / ${closedBy}` : ""}
                      </td>
                      <td className={`${tdCls} mono text-right`}>{s.paid_orders ?? "—"}</td>
                      <td className={`${tdCls} mono text-right font-medium`}>{s.net_sales_satang != null ? money(s.net_sales_satang) : "—"}</td>
                      <td className={`${tdCls} mono text-right`}>{money(s.opening_float_satang)}</td>
                      <td className={`${tdCls} mono text-right`}>{money(s.expect_cash_satang ?? 0)}</td>
                      <td className={`${tdCls} mono text-right`}>{money(s.counted_cash_satang ?? 0)}</td>
                      <td className={`${tdCls} mono text-right font-semibold`} style={{ color: tone(v) }}>
                        {signed(v)}
                      </td>
                    </tr>
                  );
                })}
                {past.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`${tdCls} py-8 text-center text-muted`}>
                      No closed shifts in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          );
        }}
      </Loadable>
      {sel && <ShiftSheet s={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
