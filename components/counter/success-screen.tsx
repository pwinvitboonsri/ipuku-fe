"use client";

import { useEffect, useState } from "react";
import { money, qty } from "@/lib/format";
import { cashPayment, itemCount, paymentLabel, salePayments } from "@/lib/orders";
import type { Order, StockAlert } from "@/lib/types";
import { Pill } from "@/components/ui/bits";

const AUTO_NEXT_S = 8;

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[14px] text-ink-2">{k}</span>
      {children}
    </div>
  );
}

// Ingredients this sale just took to/below their reorder level (or out). Shown once, at the crossing.
function StockAlertCard({ alerts }: { alerts: StockAlert[] }) {
  const out = alerts.some((a) => a.status === "OUT");
  return (
    <div
      role="alert"
      className="rise-3 mt-3 flex w-full max-w-[460px] shrink-0 flex-col gap-2 rounded-[14px] border px-5 py-4 text-left"
      style={{ background: out ? "#F6DED7" : "#F6ECCB", borderColor: out ? "#E9C3B8" : "#EBD9A6" }}
    >
      <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: out ? "#8E3522" : "#7A5A0E" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
        </svg>
        {out ? "Running out — tell the owner" : "Stock getting low — tell the owner"}
      </div>
      {alerts.map((a) => (
        <div key={a.ingredient_id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
          <span className="flex items-center gap-2 text-ink">
            <Pill tone={a.status === "OUT" ? "NEG" : "LOW"}>{a.status === "OUT" ? "Out" : "Low"}</Pill>
            {a.name}
          </span>
          <span className="mono shrink-0 text-ink-2">
            {qty(a.stock_quantity, a.unit)} left
            <span className="text-muted"> · reorder at {qty(a.reorder_level, a.unit)}</span>
          </span>
        </div>
      ))}
      <div className="text-[12px] text-ink-2">Items using these can still be sold.</div>
    </div>
  );
}

// Shown after POST /order/:id/pay. Queue number, method, and change for cash. Stock was deducted server-side.
// With a stock alert the screen waits for a tap instead of moving on, so the alert isn't missed.
export function SuccessScreen({ order, stockAlerts = [], onNextOrder }: { order: Order; stockAlerts?: StockAlert[]; onNextOrder: () => void }) {
  const hold = stockAlerts.length > 0;
  const [countdown, setCountdown] = useState(AUTO_NEXT_S);
  const sales = salePayments(order);
  const split = sales.length > 1;
  const cash = cashPayment(order);
  const change = cash?.change_satang ?? 0;

  useEffect(() => {
    if (hold) return;
    if (countdown <= 0) {
      onNextOrder();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [hold, countdown, onNextOrder]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-paper" data-screen-label="Payment success">
      <div className="h-1.5 bg-matcha" />
      <div className="scroll flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-4 pb-4 pt-6 text-center sm:px-10 sm:pt-7">
        <div className="pop draw mb-1 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-matcha" style={{ boxShadow: "0 12px 32px rgba(107,127,74,0.32)" }}>
          <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
            <path d="M12 24l8 8 16-17" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">PAID · QUEUE NUMBER</div>
        <div className="mono rise text-[60px] font-semibold leading-none tracking-[-3px] text-ink sm:text-[72px]">#{order.order_number}</div>
        <div className="serif-i rise-2 whitespace-nowrap text-[30px] leading-[1.1] tracking-[-0.5px] text-ink">Thank you.</div>

        <div className="rise-3 mt-3.5 flex w-full max-w-[460px] shrink-0 flex-col gap-2 rounded-[14px] border border-line bg-card px-5 py-4 text-left shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-semibold tracking-[0.8px] text-muted">STATUS</span>
            <Pill tone="PAID">Paid</Pill>
          </div>
          <Row k="Items">
            <span className="text-[14px] font-medium text-ink">{itemCount(order)} items</span>
          </Row>
          <Row k="Method">
            <span className="text-[14px] font-medium text-ink">{paymentLabel(order) || "—"}</span>
          </Row>
          {split
            ? sales.map((p) => (
                <Row key={p.id} k={p.method === "CASH" ? "Cash part" : p.reference ? `PromptPay · ${p.reference}` : "PromptPay part"}>
                  <span className="mono text-[14px] font-medium text-ink">{money(p.amount_satang)}</span>
                </Row>
              ))
            : !cash && (
                <Row k="Slip reference">
                  <span className={`mono text-[14px] ${sales[0]?.reference ? "text-ink" : "text-muted"}`}>{sales[0]?.reference || "—"}</span>
                </Row>
              )}
          {cash && (
            <Row k={split ? "Cash tendered" : "Tendered"}>
              <span className="mono text-[14px] font-medium text-ink">{money(cash.tender_satang ?? 0)}</span>
            </Row>
          )}
          <div className="mt-0.5 flex justify-between border-t border-line pt-2.5">
            <span className="text-[15px] font-semibold text-ink">Total paid</span>
            <span className="mono text-[18px] font-semibold text-ink">{money(order.total_satang)}</span>
          </div>
          {cash && change > 0 && (
            <div className="mt-1.5 flex items-center justify-between rounded-[12px] bg-ink px-[18px] py-3.5 text-paper">
              <span className="whitespace-nowrap text-[14px] font-medium tracking-[0.3px]">Change due</span>
              <span className="mono text-[22px] font-semibold">{money(change)}</span>
            </div>
          )}
        </div>
        {hold && <StockAlertCard alerts={stockAlerts} />}
        <div className="mt-2.5 text-[12px] text-muted">No receipt printing yet — call out the queue number.</div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-paper px-4 pb-[18px] pt-3.5 sm:px-10">
        <div className="mono whitespace-nowrap text-[13px] text-muted">{hold ? "Read the stock alert above" : `Next order in ${countdown}s…`}</div>
        <button type="button" onClick={onNextOrder} className="tap flex items-center gap-2.5 whitespace-nowrap rounded-[12px] bg-ink px-[22px] py-3.5 text-[14px] font-semibold text-paper">
          Start next order
          <svg width="16" height="12" viewBox="0 0 18 14" fill="none">
            <path d="M1 7h15M11 1l5 6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
