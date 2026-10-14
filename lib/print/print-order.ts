"use client";

import { cashPayment, grabTag, orderLines, salePayments } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { printJob } from "./escpos";
import { printImage } from "./images";
import { sendToRawbt } from "./rawbt";
import { drawReceipt, drawTicket, type Receipt } from "./receipt";
import { lines, type PrinterSettings } from "./settings";

const THAI_METHOD = { CASH: "เงินสด", PROMPTPAY: "พร้อมเพย์", GRAB: "Grab" } as const;

// Server order → slip content. Totals and change come from the server, never recomputed here.
export function orderReceipt(o: Order, settings: PrinterSettings, staff?: string): Receipt {
  const cash = cashPayment(o);
  return {
    shop: "Ippuku",
    header: lines(settings.header),
    queue: o.order_number,
    tag: grabTag(o) ?? undefined,
    when: new Date(o.paid_at ?? o.create_at),
    staff,
    counter: "001",
    lines: orderLines(o).map((l) => ({ name: l.name, mods: l.mods, qty: l.qty, unitSatang: l.unitSatang, totalSatang: l.totalSatang })),
    totalSatang: o.total_satang,
    payments: salePayments(o).map((p) => ({
      label: `${THAI_METHOD[p.method]}${p.reference ? ` · ${p.reference}` : ""}`,
      amountSatang: p.amount_satang,
    })),
    tenderSatang: cash?.tender_satang ?? null,
    changeSatang: cash ? (cash.change_satang ?? 0) : null,
    footer: lines(settings.footer),
  };
}

// The slips this tablet is set to print, in paper order: ticket first, then the customer receipt.
export function renderSlips(r: Receipt, settings: PrinterSettings, only?: "ticket" | "receipt") {
  const slips: HTMLCanvasElement[] = [];
  if (only ? only === "ticket" : settings.ticket) slips.push(drawTicket(r, settings.paper));
  if (only ? only === "receipt" : settings.receipt)
    slips.push(drawReceipt(r, settings.paper, { logo: printImage(settings.logo), bottom: printImage(settings.bottom) }));
  return slips;
}

// Render + hand to RawBT. Call from a tap (or right after one): Chrome only opens another app on a user gesture.
export function printOrder(o: Order, settings: PrinterSettings, staff?: string, only?: "ticket" | "receipt") {
  const slips = renderSlips(orderReceipt(o, settings, staff), settings, only);
  if (slips.length) sendToRawbt(printJob(slips, { cut: settings.cut }), settings.mode);
  return slips.length;
}

