// Cup stickers: one canvas per cup, drawn from the sticker template, then sent as TSPL
// (the label-printer language) with each sticker as a bitmap — Thai renders with the browser's fonts.
import { orderLines } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { escpos, PAPER_DOTS, rasterBytes } from "./escpos";
import { families, wrapText } from "./receipt";
import type { StickerLine, StickerSettings, StickerSize } from "./sticker-settings";

export type StickerData = { queue: number; item: string; options: string[]; cup: number; cups: number; when: Date; shop: string };

const DOTS_PER_MM = 8; // 203 dpi
const PAD_MM = 2;
const FONT_DOTS: Record<StickerSize, number> = { s: 24, m: 32, l: 46, xl: 80 };
const INK_LEVEL = 160; // luminance below this prints black (0–255)

// One sticker per cup, in order: a "2× Latte" line gives two stickers.
export function orderStickers(o: Order, shop = "Ippuku"): StickerData[] {
  const lines = orderLines(o);
  const cups = lines.reduce((n, l) => n + l.qty, 0);
  const when = new Date(o.paid_at ?? o.create_at);
  const out: StickerData[] = [];
  for (const l of lines) for (let i = 0; i < l.qty; i++) out.push({ queue: o.order_number, item: l.name, options: l.mods, cup: out.length + 1, cups, when, shop });
  return out;
}

export const SAMPLE_STICKER: StickerData = {
  queue: 12,
  item: "ชาเขียวมัทฉะลาเต้ เย็น",
  options: ["แก้วใหญ่", "หวานน้อย 25%", "นมโอ๊ต"],
  cup: 1,
  cups: 3,
  when: new Date(),
  shop: "Ippuku",
};

export function fillTokens(text: string, d: StickerData): string {
  const values: Record<string, string> = {
    queue: String(d.queue),
    item: d.item,
    options: d.options.join(" · "),
    cup: String(d.cup),
    cups: String(d.cups),
    time: d.when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
    date: d.when.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
    shop: d.shop,
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

type Piece = { text: string; line: StickerLine };
type Row = { pieces: Piece[]; size: number };

// Lay the template out into rows. A line whose tokens come out empty (e.g. no options) is skipped;
// a sameRow line joins the row above and stays on one line.
function layout(g: CanvasRenderingContext2D, lines: StickerLine[], d: StickerData, maxW: number, font: (l: StickerLine) => string): Row[] {
  const rows: Row[] = [];
  for (const line of lines) {
    const text = fillTokens(line.text, d).trim();
    if (!text) continue;
    const size = FONT_DOTS[line.size];
    const last = rows[rows.length - 1];
    if (line.sameRow && last) {
      last.pieces.push({ text, line });
      last.size = Math.max(last.size, size);
      continue;
    }
    g.font = font(line);
    for (const t of wrapText(g, text, maxW)) rows.push({ pieces: [{ text: t, line }], size });
  }
  return rows;
}

// Returns the sticker and whether the template ran past its bottom edge.
export function drawSticker(d: StickerData, s: Pick<StickerSettings, "width" | "height" | "lines" | "lang">): { canvas: HTMLCanvasElement; overflow: boolean } {
  // A receipt-mode head on 80 mm paper prints 72 mm (576 dots); wider rows come out as garbage
  const W = Math.min(Math.round(s.width * DOTS_PER_MM), s.lang === "escpos" ? PAPER_DOTS[80] : Infinity);
  const H = Math.round(s.height * DOTS_PER_MM);
  const pad = PAD_MM * DOTS_PER_MM;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#000";

  const { sans } = families();
  const font = (l: StickerLine) => `${l.bold ? 700 : 500} ${FONT_DOTS[l.size]}px ${sans}`;
  const rows = layout(g, s.lines, d, W - pad * 2, font);

  let y = pad - 4;
  let overflow = false;
  for (const row of rows) {
    y += Math.round(row.size * 1.3); // room for Thai upper/lower marks
    if (y > H - 2) {
      overflow = true;
      break;
    }
    const base = y - Math.round(row.size * 0.3);
    for (const { text, line } of row.pieces) {
      g.font = font(line);
      const w = g.measureText(text).width;
      const x = line.align === "right" ? W - pad - w : line.align === "center" ? (W - w) / 2 : pad;
      g.fillText(text, x, base);
    }
  }
  return { canvas, overflow };
}

// TSPL BITMAP rows: MSB = leftmost dot, and a 0 bit prints (the reverse of ESC/POS).
function bitmapBytes(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const rowBytes = Math.ceil(width / 8);
  const out = new Uint8Array(rowBytes * height).fill(0xff);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < INK_LEVEL) out[y * rowBytes + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }
  return out;
}

// Receipt-mode (ESC/POS) printers have no gap sensing. Either cut after each sticker
// (continuous sticker roll + cutter), or print each sticker exactly one sticker tall and feed
// the gap so the next lands on the next label (start with the paper at a sticker's top edge).
export function escposStickerJob(canvases: HTMLCanvasElement[], s: Pick<StickerSettings, "gap" | "flip" | "cut">): Uint8Array {
  let out: number[] = [...escpos.init(), 0x1b, 0x7b, s.flip ? 1 : 0]; // ESC { n: upside-down mode
  const gapDots = Math.round(s.gap * DOTS_PER_MM);
  for (const c of canvases) {
    const image = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const after = s.cut ? escpos.cut() : gapDots ? [0x1b, 0x4a, Math.min(255, gapDots)] : []; // ESC J n: feed n dots
    out = out.concat(rasterBytes(image), after);
  }
  return Uint8Array.from(out);
}

export function stickerJob(canvases: HTMLCanvasElement[], s: Pick<StickerSettings, "width" | "height" | "gap" | "flip" | "lang" | "cut">): Uint8Array {
  return s.lang === "tspl" ? tsplJob(canvases, s) : escposStickerJob(canvases, s);
}

// One TSPL job for a run of stickers: page setup once, then a bitmap + PRINT per sticker.
export function tsplJob(canvases: HTMLCanvasElement[], s: Pick<StickerSettings, "width" | "height" | "gap" | "flip">): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [enc.encode([`SIZE ${s.width} mm,${s.height} mm`, `GAP ${s.gap} mm,0 mm`, `DIRECTION ${s.flip ? 0 : 1}`, "REFERENCE 0,0", ""].join("\r\n"))];
  for (const c of canvases) {
    parts.push(enc.encode(`CLS\r\nBITMAP 0,0,${Math.ceil(c.width / 8)},${c.height},0,`), bitmapBytes(c), enc.encode("\r\nPRINT 1,1\r\n"));
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
