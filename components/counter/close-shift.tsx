"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { clock, money, shortDate } from "@/lib/format";
import { orderSummary, useShiftOrders } from "@/lib/orders";
import { useShiftReport } from "@/lib/reports";
import { useCurrentShift, useSignOut } from "@/lib/session";
import type { CashSession } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, Pill, Spinner, Stat, labelCls } from "@/components/ui/bits";
import { Numpad, keypad } from "@/components/ui/numpad";
import { ShiftReport } from "@/components/report/shift-report";

const COUNT_CAP_BAHT = 999_999;

function BRow({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${strong ? "mt-1 border-t border-line text-[15px] font-semibold" : "text-[13.5px]"}`}>
      <span className={strong ? "text-ink" : "text-ink-2"}>{k}</span>
      <span className="mono">{v}</span>
    </div>
  );
}

// Closed: expected and variance come from the server (float + cash taken − cash refunded),
// followed by the full shift report. The close already succeeded, so a report error never blocks sign-out.
function ClosedSummary({ s, onSignOut }: { s: CashSession; onSignOut: () => void }) {
  const report = useShiftReport(s.id, true);
  const expected = s.expect_cash_satang ?? 0;
  const counted = s.counted_cash_satang ?? 0;
  const variance = s.variance_satang ?? counted - expected;
  const tone = variance === 0 ? null : variance < 0 ? "neg" : "pos";
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-screen-label="Close shift · closed">
      <div className="scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
          <Card pad={24} className="flex flex-col gap-[18px]" style={{ animation: "rise 420ms var(--ease-out) backwards" }}>
            <div className="flex items-center gap-2.5">
              <Pill tone="PAID">Shift closed</Pill>
              <span className="text-[12.5px] text-muted">
                {shortDate(s.open_at)} · {clock(s.open_at)}–{clock(s.close_at)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">
              <Stat label="Expected" value={money(expected)} />
              <Stat label="Counted" value={money(counted)} />
              <Stat label="Variance" value={(variance > 0 ? "+" : "") + money(variance)} tone={tone} />
            </div>
            <div className="text-[13px] leading-normal text-ink-2">
              {variance === 0 ? "Drawer matches. " : variance < 0 ? `Drawer is ${money(-variance)} short. ` : `Drawer is ${money(variance)} over. `}
              Saved to Shifts in the back office.
            </div>
          </Card>
          <div className={`${labelCls} mt-2`}>Shift report</div>
          {report.isPending && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {report.isError && (
            <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
              <ErrorNote>{errorText(report.error)}</ErrorNote>
              <Btn onClick={() => report.refetch()}>Retry</Btn>
            </Card>
          )}
          {report.isSuccess && <ShiftReport report={report.data} />}
        </div>
      </div>
      <div className="border-t border-line bg-paper p-3 sm:px-6">
        <div className="mx-auto w-full max-w-[720px]">
          <Btn kind="primary" size="lg" full onClick={onSignOut}>
            Sign out
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function CloseShift() {
  const router = useRouter();
  const qc = useQueryClient();
  const signOut = useSignOut();
  const shift = useCurrentShift();
  const orders = useShiftOrders();
  const [counted, setCounted] = useState(0);
  const [closed, setClosed] = useState<CashSession | null>(null);

  const close = useMutation({
    mutationFn: () => api.post<CashSession>("/cash-session/close", { id: shift.data!.id, counted_cash_satang: counted }),
    // Don't touch the current-shift cache yet, or the app would jump to Open shift before the summary is read.
    onSuccess: (s) => setClosed(s),
  });

  // No open shift and nothing just closed → go open one.
  const noShift = shift.isSuccess && !shift.data && !closed;
  useEffect(() => {
    if (noShift) router.replace("/open-shift");
  }, [noShift, router]);

  if (closed) {
    return (
      <ClosedSummary
        s={closed}
        onSignOut={() => {
          qc.removeQueries({ queryKey: ["cash-session"] });
          signOut();
        }}
      />
    );
  }
  if (shift.isPending || orders.isPending || noShift) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (orders.isError || shift.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="text-[13px] text-persimmon-2">{errorText(orders.error ?? shift.error)}</div>
        <Btn onClick={() => orders.refetch()}>Retry</Btn>
      </div>
    );
  }

  const all = orders.data;
  const open = all.filter((o) => o.status === "OPEN");

  if (open.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6" data-screen-label="Close shift · blocked">
        <Card pad={24} className="flex w-full max-w-[480px] flex-col gap-3.5">
          <div className={labelCls}>Close shift</div>
          <div className="text-[20px] font-semibold">
            {open.length} {open.length === 1 ? "order is" : "orders are"} still open
          </div>
          <div className="text-[13.5px] leading-normal text-ink-2">Every order must be paid or voided before the drawer can be counted.</div>
          <div className="flex flex-col rounded-[12px] border border-line">
            {open.map((o, i) => (
              <div key={o.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${i ? "border-t border-line" : ""}`}>
                <span className="mono text-[16px] font-semibold">#{o.order_number}</span>
                <span className="flex-1 truncate text-[13px] text-ink-2">{orderSummary(o)}</span>
                <span className="mono text-[13px]">{money(o.total_satang)}</span>
              </div>
            ))}
          </div>
          <Btn kind="primary" size="lg" full onClick={() => router.push("/orders?status=OPEN")}>
            Resolve open orders
          </Btn>
        </Card>
      </div>
    );
  }

  const count = (s: string) => all.filter((o) => o.status === s).length;
  // every PromptPay row, refunds included (negative) — split orders count only their PromptPay part
  const promptpay = all.flatMap((o) => o.payment).filter((p) => p.method === "PROMPTPAY").reduce((s, p) => s + p.amount_satang, 0);

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" data-screen-label="Close shift · count">
      <div className="m-auto flex w-full max-w-[860px] flex-wrap justify-center gap-5 sm:gap-7">
        <div className="flex flex-[1_1_280px] flex-col gap-3.5">
          <div className={labelCls}>Close shift · step 1 of 2</div>
          <div className="text-[26px] font-semibold leading-[1.15] tracking-[-0.5px]">Count the cash drawer</div>
          <div className="text-[13.5px] leading-normal text-ink-2">Enter what&apos;s physically in the drawer. Expected cash and the difference are shown after you close.</div>
          <Card pad={16}>
            <div className={`${labelCls} mb-1.5`}>This shift</div>
            <BRow k="Orders paid" v={count("PAID")} />
            <BRow k="Voided / refunded" v={`${count("VOIDED")} / ${count("REFUNDED")}`} />
            <BRow k="PromptPay (not in drawer)" v={money(promptpay)} />
          </Card>
        </div>
        <div className="flex w-full max-w-[380px] flex-[1_1_300px] flex-col gap-2.5">
          <Card pad={16}>
            <div className={labelCls}>Counted cash</div>
            <div key={counted} className="mono num-tick mt-1 text-[38px] font-semibold tracking-[-1px]">
              {money(counted)}
            </div>
          </Card>
          <div className="flex h-[250px]">
            <Numpad
              onDigit={(d) => setCounted((v) => keypad.push(v, d, COUNT_CAP_BAHT))}
              onDouble={() => setCounted((v) => keypad.double(v, COUNT_CAP_BAHT))}
              onBack={() => setCounted((v) => keypad.back(v))}
            />
          </div>
          <Btn kind="primary" size="lg" full disabled={counted === 0 || close.isPending} onClick={() => close.mutate()}>
            {close.isPending ? "Closing…" : "Close shift"}
          </Btn>
          {close.isError && <ErrorNote>{errorText(close.error)}</ErrorNote>}
        </div>
      </div>
    </div>
  );
}
