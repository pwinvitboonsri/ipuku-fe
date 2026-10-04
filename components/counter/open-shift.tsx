"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, errorText } from "@/lib/api";
import { bahtLabel, clock, firstName, money, shortDate } from "@/lib/format";
import { qk, useNow, useSession, useStaffName } from "@/lib/session";
import type { CashSession } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, labelCls } from "@/components/ui/bits";
import { Numpad, keypad } from "@/components/ui/numpad";

const FLOAT_CAP_BAHT = 99_999;
const QUICK_FLOATS = [100_000, 200_000, 300_000]; // satang

function greeting(now: Date | null) {
  const h = now?.getHours() ?? 9;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// Owner-only: GET /cash-session requires the OWNER role, so staff don't see this card.
function LastShiftCard() {
  const nameOf = useStaffName();
  const last = useQuery({
    queryKey: ["cash-session", "last"],
    // Newest first by open_at. Not using is_opening=false: the API's @Type(() => Boolean) reads "false" as true.
    queryFn: () => api.get<CashSession[]>("/cash-session", { before: new Date().toISOString() }),
    select: (list) => list.find((s) => s.close_at),
    staleTime: 5 * 60_000,
  });
  const s = last.data;
  if (!s) return null;
  const by = nameOf(s.close_by_staff_id);
  return (
    <Card pad={14} className="flex flex-col gap-1.5">
      <div className={labelCls}>Last shift</div>
      <div className="text-[13px] text-ink-2">
        {shortDate(s.close_at)} · closed {clock(s.close_at)}
        {by ? ` by ${by}` : ""}
      </div>
      {typeof s.counted_cash_satang === "number" && (
        <div className="text-[13px] text-ink-2">
          Counted <span className="mono">{money(s.counted_cash_satang)}</span>
        </div>
      )}
    </Card>
  );
}

// Shown when GET /cash-session/current returns null. POST /cash-session/open { opening_float_satang }.
export function OpenShift() {
  const router = useRouter();
  const qc = useQueryClient();
  const now = useNow();
  const { data: user } = useSession();
  const [float, setFloat] = useState(0);

  const open = useMutation({
    mutationFn: () => api.post<CashSession>("/cash-session/open", { opening_float_satang: float }),
    onSuccess: (s) => {
      qc.setQueryData(qk.currentShift, s);
      router.replace("/sell");
    },
    onError: async (err) => {
      // A shift may already be open (the API throws BadGatewayException → 502) — re-check and carry on.
      if (err instanceof ApiError && [400, 409, 502].includes(err.status)) {
        const current = await qc.fetchQuery({ queryKey: qk.currentShift, queryFn: () => api.get<CashSession | null>("/cash-session/current") });
        if (current) router.replace("/sell");
      }
    },
  });

  if (!user) return null;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" data-screen-label="Open shift">
      <div className="m-auto flex w-full max-w-[820px] flex-wrap items-stretch justify-center gap-5 sm:gap-7">
        <div className="flex flex-[1_1_280px] flex-col justify-center gap-3.5">
          <div className={labelCls}>No shift open</div>
          <div className="serif-i text-[28px] leading-[1.1] tracking-[-0.6px] sm:text-[34px]">
            {greeting(now)}, {firstName(user.name)}.
          </div>
          <div className="text-[14px] leading-normal text-ink-2">
            Count the cash in the drawer and enter it as the opening float. Orders can&apos;t be taken until a shift is open.
          </div>
          {user.role === "OWNER" && <LastShiftCard />}
        </div>
        <div className="flex w-full max-w-[380px] flex-[1_1_300px] flex-col gap-2.5">
          <Card pad={16}>
            <div className={labelCls}>Opening float</div>
            <div key={float} className="mono num-tick mt-1 text-[38px] font-semibold tracking-[-1px]">
              {money(float)}
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_FLOATS.map((a) => (
              <Btn key={a} kind={float === a ? "primary" : "ghost"} onClick={() => setFloat(a)} className="mono">
                {bahtLabel(a)}
              </Btn>
            ))}
          </div>
          <div className="flex h-[230px]">
            <Numpad
              onDigit={(d) => setFloat((v) => keypad.push(v, d, FLOAT_CAP_BAHT))}
              onDouble={() => setFloat((v) => keypad.double(v, FLOAT_CAP_BAHT))}
              onBack={() => setFloat((v) => keypad.back(v))}
            />
          </div>
          <Btn kind="go" size="lg" full disabled={open.isPending} onClick={() => open.mutate()}>
            {open.isPending ? "Opening…" : `Open shift with ${money(float)}`}
          </Btn>
          {open.isError && <ErrorNote>{errorText(open.error)}</ErrorNote>}
        </div>
      </div>
    </div>
  );
}
