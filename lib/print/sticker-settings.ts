"use client";

import { localStore } from "./local-store";

// Cup stickers: one per cup, printed through RawBT in the printer's own mode (ESC/POS or TSPL).
// The design is a list of lines; each line's text can mix plain words and {tokens}.

export type StickerSize = "s" | "m" | "l" | "xl";
export type StickerAlign = "left" | "center" | "right";
// sameRow: print on the row above (e.g. "#12" left and "1/3" right) instead of a new row.
export type StickerLine = { id: string; text: string; size: StickerSize; bold: boolean; align: StickerAlign; sameRow: boolean };

export type StickerSettings = {
  enabled: boolean; // show sticker print buttons at all
  auto: boolean; // print stickers as soon as a payment succeeds
  printer: string; // RawBT printer name (required: stickers always go by name)
  width: number; // mm
  height: number; // mm
  gap: number; // mm between stickers on the roll
  flip: boolean; // rotate 180° if stickers come out upside down
  lang: "escpos" | "tspl"; // the printer's mode: receipt (ESC/POS) or label (TSPL)
  cut: boolean; // ESC/POS: cut after each sticker (continuous sticker roll on a printer with a cutter)
  lines: StickerLine[];
};

// Values a line can pull from the order. Shown as insert buttons in the editor.
export const STICKER_TOKENS = [
  { token: "{queue}", label: "Queue no." },
  { token: "{item}", label: "Drink" },
  { token: "{options}", label: "Options" },
  { token: "{cup}", label: "Cup no." },
  { token: "{cups}", label: "Cups total" },
  { token: "{time}", label: "Time" },
  { token: "{date}", label: "Date" },
  { token: "{shop}", label: "Shop" },
] as const;

export const newLineId = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_STICKER_LINES: StickerLine[] = [
  { id: "queue", text: "#{queue}", size: "xl", bold: true, align: "left", sameRow: false },
  { id: "cup", text: "{cup}/{cups}", size: "l", bold: true, align: "right", sameRow: true },
  { id: "item", text: "{item}", size: "l", bold: true, align: "left", sameRow: false },
  { id: "options", text: "{options}", size: "m", bold: false, align: "left", sameRow: false },
  { id: "foot", text: "{shop} · {time}", size: "s", bold: false, align: "left", sameRow: false },
];

export const DEFAULT_STICKER: StickerSettings = {
  enabled: true,
  auto: true,
  printer: "",
  width: 80,
  height: 50,
  gap: 2,
  flip: false,
  lang: "escpos",
  cut: true,
  lines: DEFAULT_STICKER_LINES,
};

const store = localStore("ipk_sticker_v1", DEFAULT_STICKER);
export const saveStickerSettings = store.save;
export const useStickerSettings = store.use;
