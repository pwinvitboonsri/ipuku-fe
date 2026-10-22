"use client";

import { cashPayment, orderLines, salePayments } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { printJob } from "./escpos";
import { printImage } from "./images";
import { sendToRawbt } from "./rawbt";
import { printOnRawbt } from "./rawbt-ws";
import { drawReceipt, drawTicket, type Receipt } from "./receipt";
import { lines, type PrinterSettings } from "./settings";
import { drawSticker, orderStickers, stickerJob } from "./sticker";
import type { StickerSettings } from "./sticker-settings";

const THAI_METHOD = { CASH: "เงินสด", PROMPTPAY: "พร้อมเพย์" } as const;

// Server order → slip content. Totals and change come from the server, never recomputed here.
export function orderReceipt(o: Order, settings: PrinterSettings, staff?: string): Receipt {
  const cash = cashPayment(o);
  return {
    shop: "Ippuku",
    header: lines(settings.header),
    queue: o.order_number,
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
    discount: o.discount_satang > 0 ? { label: o.reward_code?.reward_name ?? "Discount", satang: o.discount_satang } : null,
    // unclaimed points QR only: once collected (or refunded) it's useless on paper
    claim: o.claim_token?.url && !o.claim_token.claimed_at && o.status === "PAID" ? { url: o.claim_token.url, code: o.claim_token.display_code, points: o.claim_token.points, stamps: o.claim_token.stamps ?? 0 } : null,
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

// Slips go by name through RawBT's local server when a printer is chosen; otherwise through
// the rawbt: link to whichever printer is ticked in RawBT (that one needs a user gesture).
export async function sendSlips(bytes: Uint8Array, settings: PrinterSettings) {
  if (settings.printer) await printOnRawbt(settings.printer, bytes);
  else sendToRawbt(bytes, settings.mode);
}

// Render + send. Call from a tap (or right after one) in case the link is used.
export async function printOrder(o: Order, settings: PrinterSettings, staff?: string, only?: "ticket" | "receipt") {
  const slips = renderSlips(orderReceipt(o, settings, staff), settings, only);
  if (slips.length) await sendSlips(printJob(slips, { cut: settings.cut }), settings);
  return slips.length;
}

// One sticker per cup, to the sticker printer by name.
export async function printStickers(o: Order, sticker: StickerSettings) {
  if (!sticker.printer) throw new Error("Choose the sticker printer in Settings → Sticker printer");
  const canvases = orderStickers(o).map((d) => drawSticker(d, sticker).canvas);
  if (canvases.length) await printOnRawbt(sticker.printer, stickerJob(canvases, sticker));
  return canvases.length;
}
