"use client";

import type { ComponentType } from "react";
import { PrinterSettings } from "@/components/print/printer-settings";
import { StickerPrinterSettings } from "@/components/print/sticker-printer-settings";
import { usePrinterSettings } from "@/lib/print/settings";
import { useStickerSettings } from "@/lib/print/sticker-settings";

// Every page in the Settings sheet. To add one:
//   1. write a panel component (e.g. components/<area>/<thing>-settings.tsx)
//   2. add an entry here — the sheet lists it under its group and opens it on tap.
export type SettingsSection = {
  id: string;
  label: string;
  group: string; // heading on the index, e.g. "This tablet"
  ownerOnly?: boolean;
  useSummary?: () => string; // live one-liner under the label on the index
  Panel: ComponentType;
  width?: number; // sheet width for this page (default 520)
};

function usePrinterSummary() {
  const s = usePrinterSettings();
  if (!s.enabled) return "Off";
  const slips = s.ticket && s.receipt ? "Ticket + receipt" : s.ticket ? "Ticket" : s.receipt ? "Receipt" : "No slips";
  return [s.printer || "RawBT default", s.auto ? "Auto-print" : "Manual", slips, `${s.paper} mm`].join(" · ");
}

function useStickerSummary() {
  const s = useStickerSettings();
  if (!s.enabled) return "Off";
  return [s.printer || "No printer chosen", s.auto ? "Auto-print" : "Manual", `${s.width}×${s.height} mm`].join(" · ");
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "printer", label: "Receipt printer", group: "This tablet", useSummary: usePrinterSummary, Panel: PrinterSettings },
  { id: "sticker", label: "Sticker printer", group: "This tablet", useSummary: useStickerSummary, Panel: StickerPrinterSettings, width: 960 },
];
