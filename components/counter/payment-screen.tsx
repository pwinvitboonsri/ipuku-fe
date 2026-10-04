"use client";
/* eslint-disable @next/next/no-img-element -- the shop QR is a fixed image configured per deployment */

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ApiError, api, errorText, request } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { bahtLabel, money } from "@/lib/format";
import { orderLines } from "@/lib/orders";
import { useWideLayout } from "@/lib/orientation";
import type { Order, StockAlert } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, NeedsBE, Pill, labelCls } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { Numpad, keypad } from "@/components/ui/numpad";
import { OrderDrawer, OrderPanel } from "./order-panel";
import { ReasonSheet } from "./reason-sheet";

const TENDER_CAP_BAHT = 999_999;

// Static shop PromptPay QR (the amount isn't encoded). Configure per deployment in .env.*
const SHOP_QR = process.env.NEXT_PUBLIC_PROMPTPAY_QR_URL;
const SHOP_NAME = process.env.NEXT_PUBLIC_PROMPTPAY_NAME || "Ippuku";
const SHOP_ID = process.env.NEXT_PUBLIC_PROMPTPAY_ID_LABEL || "";

const Arrow = () => (
  <svg width="18" height="12" viewBox="0 0 20 14" fill="none">
    <path d="M1 7h17M12 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// POST /order/:id/pay body is { payments: Tender[] } — one tender, or several for a split.
// Parts must add up to the total exactly; only the (single) cash part carries tendered / change.
type Tender = { method: "CASH"; amount_satang: number; tender_satang: number } | { method: "PROMPTPAY"; amount_satang: number; reference?: string };
type PayMethod = "cash" | "qr" | "split";

function CashPanel({ total, busy, onConfirm }: { total: number; busy: boolean; onConfirm: (tender: number) => void }) {
  const [tendered, setTendered] = useState(0);
  const change = Math.max(0, tendered - total);
  const shortBy = Math.max(0, total - tendered);
  const canConfirm = tendered >= total && tendered > 0 && !busy;
  // Round-up to the next ฿100, then common notes — only amounts that cover the total
  const quick = [...new Set([Math.ceil(total / 10_000) * 10_000, 50_000, 100_000, 200_000])].filter((a) => a >= total).slice(0, 4);

  return (
    <div className="scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-[18px] pt-3.5 @[480px]:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <div className="whitespace-nowrap text-[11px] font-semibold tracking-[1.2px] text-muted">CASH PAYMENT</div>
          <div className="mt-[3px] whitespace-nowrap text-[17px] font-semibold text-ink">Enter amount tendered</div>
        </div>
        <div className="text-right">
          <div className="whitespace-nowrap text-[11px] font-semibold tracking-[1.2px] text-muted">TOTAL DUE</div>
          <div className="mono mt-0.5 whitespace-nowrap text-[22px] font-semibold text-ink">{money(total)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 rounded-[12px] border border-line bg-card px-[18px] py-3">
        <div className="text-[11px] font-medium tracking-[0.5px] text-muted">TENDERED</div>
        <div key={tendered} className="mono num-tick text-[36px] font-semibold leading-[1.1] tracking-[-1px] text-ink">
          {money(tendered)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 @[420px]:grid-cols-5">
        {quick.map((amt) => (
          <button key={amt} type="button" onClick={() => setTendered(amt)} className="tap mono whitespace-nowrap rounded-[10px] border border-line bg-paper-2 px-1 py-2.5 text-[13px] font-semibold text-ink">
            {bahtLabel(amt)}
          </button>
        ))}
        <button type="button" onClick={() => setTendered(total)} className="tap rounded-[10px] bg-ink px-1 py-2.5 text-[13px] font-semibold tracking-[0.3px] text-paper">
          Exact
        </button>
      </div>

      {/* Wide: keypad | change + confirm. Narrow: change, keypad, confirm stacked (right column becomes display:contents). */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 @[520px]:flex-row @[520px]:gap-3">
        <div className="order-2 flex min-h-[232px] @[520px]:order-none @[520px]:min-h-0 @[520px]:flex-[1.1]">
          <Numpad
            onDigit={(d) => setTendered((v) => keypad.push(v, d, TENDER_CAP_BAHT))}
            onDouble={() => setTendered((v) => keypad.double(v, TENDER_CAP_BAHT))}
            onBack={() => setTendered((v) => keypad.back(v))}
          />
        </div>
        <div className="contents @[520px]:flex @[520px]:min-h-0 @[520px]:flex-1 @[520px]:flex-col @[520px]:gap-2.5">
          <div
            className="order-1 flex min-h-0 flex-col gap-1.5 overflow-hidden rounded-[12px] px-[18px] py-3.5 @[520px]:order-none @[520px]:flex-1"
            style={{
              transition: "background-color 260ms ease, color 260ms ease, border-color 260ms ease",
              background: change > 0 ? "var(--ink)" : "var(--paper-2)",
              color: change > 0 ? "var(--paper)" : "var(--ink-2)",
              border: change > 0 ? "1px solid var(--ink)" : "1px solid var(--line)",
            }}
          >
            <div className="whitespace-nowrap text-[11px] font-semibold tracking-[1.2px]" style={{ opacity: change > 0 ? 0.7 : 0.55 }}>
              {shortBy > 0 ? "STILL OWED" : "CHANGE DUE"}
            </div>
            <div className="mono text-[32px] font-semibold leading-none tracking-[-0.5px]">
              <span key={tendered} className="num-tick">
                {shortBy > 0 ? money(shortBy) : money(change)}
              </span>
            </div>
            <div className="flex-1" />
            {change > 0 && <div className="text-[11.5px] leading-[1.4] opacity-65">Open cash drawer and return {money(change)} in change.</div>}
            {shortBy > 0 && tendered > 0 && <div className="text-[11.5px] leading-[1.4] opacity-65">Need {money(shortBy)} more to complete payment.</div>}
            {tendered === 0 && <div className="text-[11.5px] leading-[1.4] opacity-55">Tap a quick amount or enter via the keypad.</div>}
          </div>
          <button
            type="button"
            onClick={() => canConfirm && onConfirm(tendered)}
            disabled={!canConfirm}
            className="tap order-3 flex shrink-0 items-center justify-between gap-2 rounded-[12px] px-[18px] py-4 text-[15px] font-semibold @[520px]:order-none"
            style={{
              transition: "background-color 240ms ease, color 240ms ease",
              background: canConfirm ? "var(--matcha)" : "var(--paper-3)",
              color: canConfirm ? "var(--paper)" : "var(--muted)",
            }}
          >
            <span className="whitespace-nowrap">{busy ? "Confirming…" : "Confirm cash"}</span>
            <Arrow />
          </button>
        </div>
      </div>
    </div>
  );
}

// Deterministic QR-look pattern — only shown when no real shop QR is configured.
function placeholderPattern(seed: number) {
  const size = 29;
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const g = Array.from({ length: size }, () => Array.from({ length: size }, () => rand() > 0.52));
  const finder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) g[r0 + r][c0 + c] = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let r = 12; r <= 16; r++) for (let c = 11; c <= 17; c++) g[r][c] = false;
  return g;
}

function ShopQR({ size = 200 }: { size?: number }) {
  const grid = useMemo(() => placeholderPattern(4242), []);
  if (SHOP_QR) return <img src={SHOP_QR} alt="Shop PromptPay QR" width={size} height={size} className="rounded-[10px] bg-white object-contain" />;
  const cell = size / grid.length;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-[10px] bg-white opacity-30">
        {grid.map((row, r) => row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.5} height={cell + 0.5} fill="#0b0a08" /> : null)))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center p-3 text-center">
        <NeedsBE>set NEXT_PUBLIC_PROMPTPAY_QR_URL</NeedsBE>
      </div>
    </div>
  );
}

function PromptPayPanel({ total, busy, onConfirm }: { total: number; busy: boolean; onConfirm: (reference: string) => void }) {
  const [ref, setRef] = useState("");
  return (
    <div className="scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-[18px] pt-4 @[480px]:px-5 @[560px]:flex-row">
      <div className="flex shrink-0 flex-col items-center justify-center gap-2.5">
        <div className="rounded-[14px] border border-line bg-card p-3.5 shadow-md">
          <ShopQR size={200} />
        </div>
        <div className="text-center text-[12px] leading-[1.4] text-muted">
          {SHOP_NAME}
          {SHOP_ID && (
            <>
              <br />
              PromptPay · {SHOP_ID}
            </>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div>
          <div className={labelCls}>Ask customer to transfer</div>
          <div className="mono mt-1 text-[40px] font-semibold tracking-[-1px]">{money(total)}</div>
          <div className="mt-1.5 text-[13px] leading-[1.45] text-ink-2">
            This is the shop&apos;s fixed QR — the amount isn&apos;t encoded. Check the slip on their phone shows this exact amount before confirming.
          </div>
        </div>
        <Field label="Slip reference" hint="Optional · last digits of the transaction ref">
          <TextInput value={ref} onChange={(v) => setRef(v.slice(0, 100))} placeholder="e.g. KB-88213" mono />
        </Field>
        <div className="flex-1" />
        <Btn kind="go" size="lg" full disabled={busy} onClick={() => onConfirm(ref.trim())}>
          {busy ? "Confirming…" : "Payment received"}
          <Arrow />
        </Btn>
      </div>
    </div>
  );
}

const CashIcon = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
    <rect x="1" y="1" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="11" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="4" cy="4" r="0.6" fill="currentColor" />
    <circle cx="18" cy="12" r="0.6" fill="currentColor" />
  </svg>
);
const QrIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
    <rect x="3" y="3" width="3" height="3" fill="currentColor" />
    <rect x="12" y="1" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
    <rect x="14" y="3" width="3" height="3" fill="currentColor" />
    <rect x="1" y="12" width="7" height="7" stroke="currentColor" strokeWidth="1.6" />
    <rect x="3" y="14" width="3" height="3" fill="currentColor" />
    <rect x="11" y="11" width="2" height="2" fill="currentColor" />
    <rect x="14" y="11" width="2" height="2" fill="currentColor" />
    <rect x="17" y="11" width="2" height="2" fill="currentColor" />
    <rect x="11" y="14" width="2" height="2" fill="currentColor" />
    <rect x="17" y="14" width="2" height="2" fill="currentColor" />
    <rect x="14" y="17" width="2" height="2" fill="currentColor" />
    <rect x="17" y="17" width="2" height="2" fill="currentColor" />
  </svg>
);

type PromptPayPart = { amount_satang: number; reference: string };

// One PromptPay part of a split: amount on the keypad (≤ what's left), shop QR, optional slip ref.
function PromptPayPartPanel({ remaining, onAdd, onBack }: { remaining: number; onAdd: (part: PromptPayPart) => void; onBack: () => void }) {
  const [amount, setAmount] = useState(0);
  const [ref, setRef] = useState("");
  const capBaht = Math.floor(remaining / 100);
  const ok = amount > 0 && amount <= remaining;
  return (
    <div className="scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-[18px] pt-3.5 @[480px]:px-5 @[600px]:flex-row @[600px]:gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <button type="button" onClick={onBack} className="tap text-[13px] font-medium text-ink-2">
            ← Back to split
          </button>
          <span className="text-[12px] text-muted">
            Left to pay <span className="mono text-ink">{money(remaining)}</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[12px] border border-line bg-card px-[18px] py-3">
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted">PROMPTPAY PART</div>
          <div key={amount} className="mono num-tick text-[36px] font-semibold leading-[1.1] tracking-[-1px] text-ink">
            {money(amount)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => setAmount(Math.round(remaining / 2))} className="tap rounded-[10px] border border-line bg-paper-2 py-2.5 text-[13px] font-semibold text-ink">
            Half · <span className="mono">{money(Math.round(remaining / 2))}</span>
          </button>
          <button type="button" onClick={() => setAmount(remaining)} className="tap rounded-[10px] bg-ink py-2.5 text-[13px] font-semibold text-paper">
            All left · <span className="mono">{money(remaining)}</span>
          </button>
        </div>
        <div className="flex min-h-[220px] flex-1">
          <Numpad
            onDigit={(d) => setAmount((v) => keypad.push(v, d, capBaht))}
            onDouble={() => setAmount((v) => keypad.double(v, capBaht))}
            onBack={() => setAmount((v) => keypad.back(v))}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-3 @[600px]:w-[230px]">
        <div className="rounded-[14px] border border-line bg-card p-3 shadow-md">
          <ShopQR size={160} />
        </div>
        <div className="text-center text-[12.5px] leading-[1.45] text-ink-2">Check the slip shows exactly {money(amount)}.</div>
        <div className="w-full">
          <Field label="Slip reference" hint="Optional">
            <TextInput value={ref} onChange={(v) => setRef(v.slice(0, 100))} placeholder="e.g. KB-88213" mono />
          </Field>
        </div>
        <Btn kind="go" size="lg" full disabled={!ok} onClick={() => onAdd({ amount_satang: amount, reference: ref.trim() })}>
          Received {money(amount)}
        </Btn>
      </div>
    </div>
  );
}

// Split: any number of PromptPay parts, then the rest in cash (with change). Nothing is sent
// until the whole total is covered — one atomic pay call, so there's never a half-paid order.
function SplitPanel({ total, busy, onConfirm }: { total: number; busy: boolean; onConfirm: (tenders: Tender[]) => void }) {
  const [parts, setParts] = useState<PromptPayPart[]>([]);
  const [step, setStep] = useState<"list" | "qr" | "cash">("list");
  const remaining = total - parts.reduce((t, p) => t + p.amount_satang, 0);
  const promptpay = (): Tender[] => parts.map((p) => ({ method: "PROMPTPAY", amount_satang: p.amount_satang, ...(p.reference ? { reference: p.reference } : {}) }));

  if (step === "qr") {
    return (
      <PromptPayPartPanel
        remaining={remaining}
        onBack={() => setStep("list")}
        onAdd={(part) => {
          setParts((ps) => [...ps, part]);
          setStep("list");
        }}
      />
    );
  }
  if (step === "cash") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-baseline justify-between gap-3 px-3 pt-3 @[480px]:px-5">
          <button type="button" onClick={() => setStep("list")} className="tap text-[13px] font-medium text-ink-2">
            ← Back to split
          </button>
          <span className="text-[12px] text-muted">
            PromptPay <span className="mono text-ink">{money(total - remaining)}</span> · cash for the rest
          </span>
        </div>
        <CashPanel total={remaining} busy={busy} onConfirm={(tender) => onConfirm([...promptpay(), { method: "CASH", amount_satang: remaining, tender_satang: tender }])} />
      </div>
    );
  }

  return (
    <div className="scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-[18px] pt-3.5 @[480px]:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <div className="text-[11px] font-semibold tracking-[1.2px] text-muted">SPLIT PAYMENT</div>
          <div className="mt-[3px] text-[17px] font-semibold text-ink">Part PromptPay, rest in cash</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-[1.2px] text-muted">TOTAL DUE</div>
          <div className="mono mt-0.5 text-[22px] font-semibold text-ink">{money(total)}</div>
        </div>
      </div>

      <Card pad={0}>
        {parts.length === 0 && <div className="px-4 py-3.5 text-[13px] text-muted">No parts yet. Take a PromptPay transfer first, then the rest in cash.</div>}
        {parts.map((p, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
            <QrIcon />
            <span className="min-w-0 flex-1 text-[14px] font-medium">
              PromptPay
              {p.reference && <span className="mono ml-2 text-[12px] text-muted">{p.reference}</span>}
            </span>
            <span className="mono text-[14px] font-semibold">{money(p.amount_satang)}</span>
            <button
              type="button"
              aria-label="Remove part"
              disabled={busy}
              onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}
              className="tap -mr-1.5 rounded-full px-2 py-1 text-[16px] leading-none text-muted"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-line bg-paper-2 px-4 py-3">
          <span className="text-[12px] font-semibold tracking-[0.8px] text-muted">{remaining > 0 ? "LEFT TO PAY" : "COVERED"}</span>
          <span className="mono text-[22px] font-semibold text-ink">{money(remaining)}</span>
        </div>
      </Card>

      <div className="flex-1" />
      {remaining > 0 ? (
        <div className="flex flex-col gap-2 @[480px]:flex-row">
          <Btn kind="secondary" size="lg" full disabled={busy} onClick={() => setStep("qr")}>
            <QrIcon />
            Add PromptPay part
          </Btn>
          <Btn kind="primary" size="lg" full disabled={busy || parts.length === 0} onClick={() => setStep("cash")}>
            <CashIcon />
            Rest by cash · <span className="mono">{money(remaining)}</span>
          </Btn>
        </div>
      ) : (
        <Btn kind="go" size="lg" full disabled={busy} onClick={() => onConfirm(promptpay())}>
          {busy ? "Confirming…" : `Confirm ${money(total)}`}
          <Arrow />
        </Btn>
      )}
      {parts.length === 0 && remaining > 0 && <div className="text-center text-[12px] text-muted">All cash or all PromptPay? Use those tabs instead.</div>}
    </div>
  );
}

const SplitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 1.8V10l5.8 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

function MethodTabs({ method, onChange }: { method: PayMethod; onChange: (m: PayMethod) => void }) {
  const tabs: { id: PayMethod; label: string; sub: string; icon: ReactNode }[] = [
    { id: "cash", label: "Cash", sub: "Tendered + change", icon: <CashIcon /> },
    { id: "qr", label: "PromptPay", sub: "Shop QR · staff confirms", icon: <QrIcon /> },
    { id: "split", label: "Split", sub: "PromptPay + cash", icon: <SplitIcon /> },
  ];
  return (
    <div className="shrink-0 px-3 pt-3 @[480px]:px-5">
      <GlassTabs
        full
        radius={16}
        value={method}
        onChange={onChange}
        items={tabs.map((t) => ({
          id: t.id,
          label: (
            <span className="flex items-center gap-3 py-1">
              <span className="flex" style={{ opacity: method === t.id ? 1 : 0.55, transition: "opacity 280ms ease" }}>
                {t.icon}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-[15px] font-semibold tracking-[-0.2px]">{t.label}</span>
                <span className="mt-px hidden text-[11.5px] font-medium opacity-70 @[440px]:block">{t.sub}</span>
              </span>
            </span>
          ),
        }))}
      />
    </div>
  );
}

function CreateOverlay({ state, error, clientOrderId, onRetry, onBack }: { state: "creating" | "retry" | "error"; error: string | null; clientOrderId: string | null; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-[6] flex items-center justify-center p-8" style={{ background: "rgba(245,241,232,0.92)" }}>
      {state === "creating" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-yuzu" style={{ animation: "pulse 1.2s ease infinite" }} />
          <div className="text-[16px] font-semibold">Creating order…</div>
        </div>
      ) : (
        <Card pad={22} className="flex max-w-[380px] flex-col gap-3">
          <div className="text-[17px] font-semibold">{state === "retry" ? "Couldn't reach the server" : "The order wasn't created"}</div>
          <div className="text-[13px] leading-normal text-ink-2">
            {state === "retry"
              ? "The request timed out. Retrying is safe — it reuses the same order ID, so the customer won't get a duplicate."
              : error}
          </div>
          {state === "retry" && clientOrderId && <div className="mono text-[11px] text-muted">client_order_id {clientOrderId.slice(0, 18)}…</div>}
          <div className="flex gap-2">
            <Btn kind="secondary" onClick={onBack}>
              Back to cart
            </Btn>
            {state === "retry" && (
              <Btn kind="primary" style={{ flex: 1 }} onClick={onRetry}>
                Retry
              </Btn>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// Take payment. The order already exists (OPEN), so leaving means voiding it.
export function PaymentScreen() {
  const cart = useCart();
  const order = cart.order;
  const [method, setMethod] = useState<PayMethod>("cash");
  const [voidOpen, setVoidOpen] = useState(false);

  const pay = useMutation({
    // request() keeps meta, which carries the low-stock alerts for this sale
    mutationFn: (payments: Tender[]) => request<Order>(`/api/v1/order/${order!.id}/pay`, { method: "POST", body: JSON.stringify({ payments }) }),
    onSuccess: (res) => cart.paid(res.data, (res.meta?.stock_alerts as StockAlert[] | undefined) ?? []),
  });
  const voidOrder = useMutation({
    mutationFn: (reason: string) => api.post<Order>(`/order/${order!.id}/void`, { reason }),
    onSuccess: (o) => cart.voided(o),
  });

  const wide = useWideLayout();
  const pending = !order;
  const lines = order ? orderLines(order) : cart.lines;
  const total = order ? order.total_satang : cart.previewTotal;
  const notOpen = pay.error instanceof ApiError && /not OPEN/i.test(pay.error.message);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-screen-label="Payment">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-line bg-paper px-3 py-2.5 sm:px-5">
        <div className="flex items-baseline gap-2.5 whitespace-nowrap">
          <span className="text-[17px] font-semibold">Take payment</span>
          <span className="mono text-[13px] text-muted">{pending ? "· creating order…" : `· Queue #${order.order_number}`}</span>
        </div>
        {!pending && (
          <span className="hidden sm:inline">
            <Pill tone="OPEN">Open · unpaid</Pill>
          </span>
        )}
        <div className="flex-1" />
        {!pending && (
          <Btn kind="dangerSoft" size="sm" onClick={() => setVoidOpen(true)}>
            Void &amp; edit<span className="hidden sm:inline">&nbsp;order</span>
          </Btn>
        )}
      </div>

      <div className={`relative flex min-h-0 flex-1 ${wide ? "" : "flex-col"}`}>
        <div className={`@container flex min-h-0 flex-col ${wide ? "w-[60%]" : "flex-1"}`}>
          <MethodTabs method={method} onChange={setMethod} />
          <div key={method} className="fade-swap flex min-h-0 flex-1 flex-col">
            {method === "cash" ? (
              <CashPanel total={total} busy={pay.isPending} onConfirm={(tender) => pay.mutate([{ method: "CASH", amount_satang: total, tender_satang: tender }])} />
            ) : method === "qr" ? (
              <PromptPayPanel total={total} busy={pay.isPending} onConfirm={(reference) => pay.mutate([{ method: "PROMPTPAY", amount_satang: total, ...(reference ? { reference } : {}) }])} />
            ) : (
              <SplitPanel total={total} busy={pay.isPending} onConfirm={(tenders) => pay.mutate(tenders)} />
            )}
          </div>
          {pay.isError && (
            <div className="px-3 pb-3 sm:px-5">
              <ErrorNote>{notOpen ? "This order is no longer open — check Orders for its status." : errorText(pay.error)}</ErrorNote>
            </div>
          )}
        </div>
        {wide ? (
          <div className="w-[40%] min-h-0">
            <OrderPanel lines={lines} total={total} locked orderNumber={order?.order_number} />
          </div>
        ) : (
          <OrderDrawer lines={lines} total={total} locked orderNumber={order?.order_number} />
        )}
        {cart.createState && <CreateOverlay state={cart.createState} error={cart.createError} clientOrderId={cart.pendingId} onRetry={cart.retryCreate} onBack={cart.backToCart} />}
      </div>

      {voidOpen && order && (
        <ReasonSheet
          kind="void"
          orderNumber={order.order_number}
          total={order.total_satang}
          busy={voidOrder.isPending}
          error={voidOrder.isError ? errorText(voidOrder.error) : null}
          onClose={() => setVoidOpen(false)}
          onSubmit={(reason) => voidOrder.mutate(reason)}
        />
      )}
    </div>
  );
}
