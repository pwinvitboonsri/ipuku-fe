"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { glyphOf, itemTone } from "./tone";
import type { Order, OrderStatus, Payment } from "./types";

// All order queries share the ["order", …] prefix so one invalidate refreshes lists, counts and badges.
export const orderKeys = {
  all: ["order"] as const,
  shift: ["order", "shift"] as const,
};

// GET /order — this shift's orders (defaults to the open cash session), newest first.
export const fetchShiftOrders = () => api.get<Order[]>("/order");

export function useShiftOrders() {
  return useQuery({
    queryKey: orderKeys.shift,
    queryFn: fetchShiftOrders,
    staleTime: 0,
  });
}

// One row for the order panel, from either the device cart or a server order.
export type DisplayLine = {
  key: string;
  productId: string;
  name: string;
  mods: string[];
  qty: number;
  unitSatang: number;
  totalSatang: number;
  imageUrl?: string | null;
};

export function orderLines(o: Order): DisplayLine[] {
  return o.order_item.map((i) => ({
    key: i.id,
    productId: i.product_id,
    name: i.product_name_snapshot,
    mods: i.order_item_modifier.map((m) => m.name_snapshot),
    qty: i.quantity,
    unitSatang: i.unit_price_satang,
    totalSatang: i.line_total_satang,
  }));
}

export const lineTone = (l: { productId: string }) => itemTone(l.productId);
export const lineGlyph = (l: { name: string }) => glyphOf(l.name);

export function orderSummary(o: Order) {
  return o.order_item.map((l) => (l.quantity > 1 ? `${l.quantity}× ` : "") + l.product_name_snapshot).join(", ");
}

export const itemCount = (o: Order) => o.order_item.reduce((s, i) => s + i.quantity, 0);

// An order is paid by one or more tenders (positive rows, e.g. PromptPay + cash);
// a refund adds one negative row per tender, same method.
export const salePayments = (o: Order): Payment[] => o.payment.filter((p) => p.amount_satang > 0);
export const refundPayments = (o: Order): Payment[] => o.payment.filter((p) => p.amount_satang < 0);
// At most one cash tender per order — the one that carries tendered / change.
export const cashPayment = (o: Order): Payment | undefined => salePayments(o).find((p) => p.method === "CASH");

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", PROMPTPAY: "PromptPay", GRAB: "Grab", MIXED: "Cash + PromptPay" };
export const methodLabel = (m?: string) => (m && METHOD_LABEL[m]) || "—";

// "Cash", "PromptPay", "Cash + PromptPay", "PromptPay ×2"; "" when unpaid.
export function paymentLabel(o: Order): string {
  const rows = salePayments(o);
  if (!rows.length) return "";
  const methods = [...new Set(rows.map((p) => p.method))];
  if (methods.length > 1) return methods.map(methodLabel).join(" + ");
  return methodLabel(methods[0]) + (rows.length > 1 ? ` ×${rows.length}` : "");
}

// "GRAB GF-123" for Grab orders, null for walk-ins
export const grabTag = (o: Order) => (o.channel === "GRAB" ? `GRAB ${o.grab_order?.short_order_number ?? ""}`.trim() : null);
// A Grab order nobody has tapped "Got it" on yet (cancelled ones no longer matter)
export const needsAck = (o: Order) => o.channel === "GRAB" && o.status === "PAID" && !!o.grab_order && !o.grab_order.acknowledged_at;

export const STATUSES: OrderStatus[] = ["OPEN", "PAID", "VOIDED", "REFUNDED"];
export const statusLabel = (s: OrderStatus) => s[0] + s.slice(1).toLowerCase();
