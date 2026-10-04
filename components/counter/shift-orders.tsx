"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { clock, money } from "@/lib/format";
import { STATUSES, methodLabel, orderKeys, orderSummary, paymentLabel, refundPayments, salePayments, statusLabel, useShiftOrders } from "@/lib/orders";
import { useTwoPane } from "@/lib/orientation";
import { useCurrentShift, useSession, useStaffName } from "@/lib/session";
import type { Order, OrderStatus } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, PageHead, Pill, Spinner, labelCls } from "@/components/ui/bits";
import { FilterChips } from "@/components/ui/glass-tabs";
import { ReasonSheet } from "./reason-sheet";

type Filter = "ALL" | OrderStatus;

function OrderRow({ o, on, staff, onTap }: { o: Order; on: boolean; staff?: string; onTap: () => void }) {
  const voided = o.status === "VOIDED";
  const paidBy = paymentLabel(o);
  return (
    <button
      type="button"
      onClick={onTap}
      className="tap grid w-full items-center gap-3 rounded-[12px] px-3.5 py-3 text-left"
      style={{
        gridTemplateColumns: "56px minmax(0,1fr) auto",
        background: on ? "var(--card)" : "transparent",
        border: on ? "1px solid var(--line-2)" : "1px solid transparent",
        boxShadow: on ? "var(--shadow-sm)" : "none",
      }}
    >
      <span className={`mono text-[20px] font-semibold ${voided ? "text-muted" : "text-ink"}`}>#{o.order_number}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`truncate text-[14px] font-medium ${voided ? "text-muted line-through" : "text-ink"}`}>{orderSummary(o)}</span>
        <span className="text-[12px] text-muted">
          {clock(o.create_at)}
          {staff ? ` · ${staff}` : ""}
          {paidBy ? ` · ${paidBy}` : ""}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="mono text-[14px] font-semibold">{money(o.total_satang)}</span>
        <Pill tone={o.status}>{o.status}</Pill>
      </span>
    </button>
  );
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between py-[3px] text-[13.5px]">
      <span className="text-ink-2">{k}</span>
      <span className={`font-medium ${mono ? "mono" : ""}`}>{v}</span>
    </div>
  );
}

function OrderDetail({ o, isOwner, staff, onVoid, onRefund, onTakePayment }: { o: Order; isOwner: boolean; staff?: string; onVoid: () => void; onRefund: () => void; onTakePayment: () => void }) {
  const sales = salePayments(o);
  const refunds = refundPayments(o);
  const split = sales.length > 1;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 pb-3.5 pt-[18px] sm:px-5">
        <span className="mono text-[28px] font-semibold">#{o.order_number}</span>
        <Pill tone={o.status}>{o.status}</Pill>
        <span className="ml-auto text-[12.5px] text-muted">
          {clock(o.create_at)}
          {staff ? ` · ${staff}` : ""}
        </span>
      </div>
      <div className="scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-2.5 sm:px-5">
        <div>
          {o.order_item.map((l) => (
            <div key={l.id} className="flex justify-between gap-3 border-b border-line py-2.5">
              <div>
                <div className="text-[14.5px] font-medium">
                  {l.quantity} × {l.product_name_snapshot}
                </div>
                {l.order_item_modifier.length > 0 && <div className="mt-0.5 text-[12.5px] text-muted">{l.order_item_modifier.map((m) => m.name_snapshot).join(" · ")}</div>}
              </div>
              <span className="mono text-[14px]">{money(l.line_total_satang)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2.5 text-[17px] font-semibold">
            <span>Total</span>
            <span className="mono">{money(o.total_satang)}</span>
          </div>
        </div>
        {sales.length > 0 && (
          <Card pad={14}>
            <div className={`${labelCls} mb-1.5`}>{split ? "Payment · split" : "Payment"}</div>
            {sales.map((p, i) => (
              <div key={p.id} className={split && i ? "mt-1.5 border-t border-line pt-1.5" : ""}>
                <KV k={split ? methodLabel(p.method) : "Method"} v={split ? money(p.amount_satang) : methodLabel(p.method)} mono={split} />
                {p.method === "CASH" ? (
                  <>
                    <KV k="Tendered" v={money(p.tender_satang ?? 0)} mono />
                    <KV k="Change" v={money(p.change_satang ?? 0)} mono />
                  </>
                ) : (
                  <KV k="Slip reference" v={p.reference || "—"} mono />
                )}
              </div>
            ))}
            {refunds.map((r) => (
              <KV key={r.id} k={split ? `Refunded · ${methodLabel(r.method)}` : "Refunded"} v={`${money(r.amount_satang)} · ${clock(r.create_at)}`} mono />
            ))}
          </Card>
        )}
        {(o.status === "VOIDED" || o.status === "REFUNDED") && (
          <div className="text-[12px] text-muted">The {o.status === "VOIDED" ? "void" : "refund"} reason is kept in the audit log.</div>
        )}
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-2.5 border-t border-line bg-paper-2 p-3 sm:p-3.5">
        {o.status === "OPEN" && (
          <>
            <Btn kind="dangerSoft" onClick={onVoid}>
              Void…
            </Btn>
            <Btn kind="primary" size="lg" className="min-w-[200px]" style={{ flex: 1 }} onClick={onTakePayment}>
              Take payment · {money(o.total_satang)}
            </Btn>
          </>
        )}
        {o.status === "PAID" &&
          (isOwner ? (
            <>
              <Btn kind="dangerSoft" onClick={onRefund}>
                Refund…
              </Btn>
              <span className="text-[12px] text-muted">Only during this shift · stock isn&apos;t returned</span>
            </>
          ) : (
            <span className="text-[12.5px] text-muted">Refunds are owner-only. Ask the owner to sign in.</span>
          ))}
        {(o.status === "VOIDED" || o.status === "REFUNDED") && <span className="text-[12.5px] text-muted">Final — no further actions.</span>}
      </div>
    </div>
  );
}

export function ShiftOrders() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const cart = useCart();
  const { data: user } = useSession();
  const shift = useCurrentShift();
  const staffName = useStaffName();
  const orders = useShiftOrders();
  const twoPane = useTwoPane();
  const initial = (params.get("status") as Filter | null) ?? "ALL";
  const [filter, setFilter] = useState<Filter>(STATUSES.includes(initial as OrderStatus) ? initial : "ALL");
  const [selId, setSelId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"void" | "refund" | null>(null);

  const act = useMutation({
    mutationFn: ({ kind, id, reason }: { kind: "void" | "refund"; id: string; reason: string }) => api.post<Order>(`/order/${id}/${kind}`, { reason }),
    onSuccess: () => {
      setSheet(null);
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  if (orders.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Loading orders…" />
      </div>
    );
  }
  if (orders.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="text-[13px] text-persimmon-2">{errorText(orders.error)}</div>
        <Btn onClick={() => orders.refetch()}>Retry</Btn>
      </div>
    );
  }

  const all = orders.data;
  const list = all.filter((o) => filter === "ALL" || o.status === filter);
  // Two panes: something is always selected. One pane (phone): list until an order is tapped.
  const sel = list.find((o) => o.id === selId) ?? (twoPane ? list[0] : undefined);
  const showList = twoPane || !sel;
  const showDetail = twoPane || !!sel;
  const opener = staffName(shift.data?.opened_by_staff_id);
  const sub = shift.data ? `Opened ${clock(shift.data.open_at)}${opener ? ` by ${opener}` : ""} · newest first` : "Newest first";

  return (
    <div className="relative grid min-h-0 flex-1" style={{ gridTemplateColumns: twoPane ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)" }} data-screen-label="Shift orders">
      {showList && (
      <div className="flex min-h-0 flex-col border-line md:border-r">
        <div className="flex flex-col gap-3 px-3 pb-3 pt-4 sm:px-[18px]">
          <PageHead title="This shift's orders" sub={sub} />
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[{ value: "ALL" as Filter, label: "All", count: all.length }, ...STATUSES.map((s) => ({ value: s as Filter, label: statusLabel(s), count: all.filter((o) => o.status === s).length }))]}
          />
        </div>
        <div key={filter} className="scroll stagger flex-1 overflow-y-auto px-1.5 pb-3.5 sm:px-2.5">
          {list.map((o) => (
            <OrderRow key={o.id} o={o} on={!!sel && o.id === sel.id} staff={staffName(o.staff_id)} onTap={() => setSelId(o.id)} />
          ))}
          {list.length === 0 && <div className="p-8 text-center text-[13.5px] text-muted">{all.length ? "No orders with this status." : "No orders yet this shift."}</div>}
        </div>
      </div>
      )}
      {showDetail && (
      <div className="flex min-h-0 flex-col bg-paper">
        {!twoPane && (
          <button type="button" onClick={() => setSelId(null)} className="tap flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2.5 text-left text-[13.5px] font-semibold text-ink-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All orders
          </button>
        )}
        {sel && (
          <div key={sel.id} className="fade-swap min-h-0 flex-1">
            <OrderDetail
              o={sel}
              isOwner={user?.role === "OWNER"}
              staff={staffName(sel.staff_id)}
              onVoid={() => {
                act.reset();
                setSheet("void");
              }}
              onRefund={() => {
                act.reset();
                setSheet("refund");
              }}
              onTakePayment={() => {
                cart.takePaymentFor(sel);
                router.push("/sell");
              }}
            />
          </div>
        )}
      </div>
      )}
      {sheet && sel && (
        <ReasonSheet
          kind={sheet}
          orderNumber={sel.order_number}
          total={sel.total_satang}
          payments={salePayments(sel)}
          busy={act.isPending}
          error={act.isError ? errorText(act.error) : null}
          onClose={() => setSheet(null)}
          onSubmit={(reason) => act.mutate({ kind: sheet, id: sel.id, reason })}
        />
      )}
    </div>
  );
}
