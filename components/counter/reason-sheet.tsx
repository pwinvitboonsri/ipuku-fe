"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { Btn } from "@/components/ui/btn";
import { ErrorNote } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import type { Payment } from "@/lib/types";

const QUICK = {
  void: ["Customer changed order", "Wrong item rung up", "Customer left"],
  refund: ["Item made wrong", "Customer complaint", "Charged twice"],
};

const howBack = (m: string) => (m === "CASH" ? "cash from the drawer" : "PromptPay transfer (done in your banking app)");

// A refund goes back the way each tender came in.
function refundCopy(total: number, payments: Pick<Payment, "method" | "amount_satang">[]) {
  if (payments.length <= 1) return `Returns ${money(total)} by ${howBack(payments[0]?.method ?? "PROMPTPAY")}.`;
  return `Returns ${money(total)}: ${payments.map((p) => `${money(p.amount_satang)} ${howBack(p.method)}`).join(" + ")}.`;
}

// Shared by Void (OPEN orders) and Refund (PAID, owner only). Reason is required (max 255).
export function ReasonSheet({
  kind,
  orderNumber,
  total,
  payments = [],
  busy,
  error,
  onClose,
  onSubmit,
}: {
  kind: "void" | "refund";
  orderNumber: number;
  total: number;
  // the order's sale tenders (refund only)
  payments?: Pick<Payment, "method" | "amount_satang">[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isVoid = kind === "void";
  const ok = reason.trim().length > 0 && !busy;
  return (
    <Sheet
      tone="danger"
      onClose={onClose}
      title={isVoid ? `Void order #${orderNumber}?` : `Refund order #${orderNumber}?`}
      sub={
        isVoid
          ? "The order is kept with status VOIDED. Nothing was charged."
          : `${refundCopy(total, payments)} Stock is not put back.`
      }
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Keep order
          </Btn>
          <Btn kind="danger" disabled={!ok} onClick={() => onSubmit(reason.trim())}>
            {busy ? "Working…" : isVoid ? "Void order" : `Refund ${money(total)}`}
          </Btn>
        </>
      }
    >
      <Field label="Reason" hint="Required · saved to the audit log">
        <TextInput value={reason} onChange={(v) => setReason(v.slice(0, 255))} placeholder={isVoid ? "Why is this order being voided?" : "Why is this order being refunded?"} autoFocus />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {QUICK[kind].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setReason(q)}
            className="tap rounded-full border border-line-2 px-3 py-[7px] text-[12.5px] font-medium"
            style={{ background: reason === q ? "var(--ink)" : "var(--card)", color: reason === q ? "var(--paper)" : "var(--ink-2)" }}
          >
            {q}
          </button>
        ))}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Sheet>
  );
}
