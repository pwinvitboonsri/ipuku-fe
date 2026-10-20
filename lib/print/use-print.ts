"use client";

import { useState } from "react";
import { errorText } from "@/lib/api";
import type { Order } from "@/lib/types";
import { printOrder, printStickers } from "./print-order";
import { usePrinterSettings } from "./settings";
import { useStickerSettings } from "./sticker-settings";

export type PrintStatus = { text: string; error: boolean };

// Print buttons for one order: slips (ticket + receipt) and cup stickers, each on its own printer.
export function usePrintOrder(order: Order, staff?: string) {
  const printer = usePrinterSettings();
  const sticker = useStickerSettings();
  const [status, setStatus] = useState<PrintStatus | null>(null);
  const [busy, setBusy] = useState(false);

  async function print({ slips, stickers }: { slips: boolean; stickers: boolean }) {
    slips &&= printer.enabled;
    stickers &&= sticker.enabled;
    if (!slips && !stickers) return;
    setBusy(true);
    const sent: string[] = [];
    const errors: string[] = [];
    // Stickers first: they always go over RawBT's local server, so a slip sent by link
    // (which switches to the RawBT app) still goes out right after the tap.
    if (stickers) {
      try {
        const n = await printStickers(order, sticker);
        if (n) sent.push(`${n} sticker${n === 1 ? "" : "s"}`);
      } catch (err) {
        errors.push(`Stickers: ${errorText(err)}`);
      }
    }
    if (slips) {
      try {
        if (await printOrder(order, printer, staff)) sent.push("receipt");
      } catch (err) {
        errors.push(`Receipt: ${errorText(err)}`);
      }
    }
    setBusy(false);
    setStatus(errors.length ? { text: errors.join(" · "), error: true } : { text: sent.length ? `Sent ${sent.join(" + ")}.` : "Nothing to print.", error: false });
  }

  return { printer, sticker, status, busy, print };
}
