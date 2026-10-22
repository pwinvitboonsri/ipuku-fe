// Draws the two slips onto canvases sized to the printer's dot width:
//  - Ticket: short, for the bar — queue number and what to make, big.
//  - Customer receipt: logo, shop details, items, totals, payment, footer, bottom picture.
// Text goes through the browser's fonts. Latin uses the app's own faces (DM Sans, JetBrains Mono,
// Newsreader); those files have no Thai, so Thai falls back per glyph to the device's Thai font.
import { money } from "@/lib/format";
import { drawQr } from "@/lib/qr";
import { PAPER_DOTS, type PaperWidth } from "./escpos";

export type ReceiptLine = { name: string; mods: string[]; qty: number; unitSatang: number; totalSatang: number };
export type ReceiptPayment = { label: string; amountSatang: number };
export type Receipt = {
  shop: string;
  header?: string[]; // branch, address, phone, tax ID…
  queue: number;
  when: Date;
  staff?: string;
  counter?: string;
  lines: ReceiptLine[];
  totalSatang: number;
  payments: ReceiptPayment[];
  tenderSatang?: number | null;
  changeSatang?: number | null;
  footer?: string[];
  // loyalty reward used on this order (a fixed discount set by the API)
  discount?: { label: string; satang: number } | null;
  // loyalty: one-time "scan with LINE to collect points" QR (same token as the success screen)
  claim?: { url: string; code: string; points: number; stamps?: number } | null;
};
export type ReceiptImages = { logo?: HTMLImageElement | null; bottom?: HTMLImageElement | null };

const MAX_HEIGHT = 8000; // dots (~1 m); scratch canvas, cropped to what's used
const THAI = `"Noto Sans Thai", "Noto Sans Thai UI", "Sarabun", "Thonburi", "Leelawadee UI"`;

function appFont(cssVar: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v || fallback;
}

// App face first so Latin/digits use it; Thai glyphs fall through to the Thai stack
export function families() {
  return {
    sans: `${appFont("--font-dm-sans", "system-ui")}, ${THAI}, sans-serif`,
    mono: `${appFont("--font-jetbrains", "ui-monospace")}, ${THAI}, monospace`,
    serif: `${appFont("--font-newsreader", "Georgia")}, ${THAI}, serif`,
  };
}

const when = (d: Date) =>
  `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("en-GB", { hour12: false })}`;

// Breaks text into lines that fit maxW in the context's current font.
// Splits on words, not spaces: Thai has no spaces between words.
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;
export function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let cur = "";
  const parts = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : text.split(/(?<=\s)/);
  for (const segment of parts) {
    const next = cur + segment;
    if (cur && g.measureText(next).width > maxW) {
      out.push(cur.trimEnd());
      cur = segment.trimStart();
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

// Small layout helper: a tall white scratch canvas, a y cursor, and text/rule/image primitives.
class Pen {
  readonly W: number;
  readonly s: number;
  readonly pad: number;
  y: number;
  private c = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  readonly f = families();

  constructor(paper: PaperWidth) {
    this.W = PAPER_DOTS[paper];
    this.s = this.W / 576; // sizes below are tuned for 80 mm and scaled for 58 mm
    this.pad = this.px(6);
    this.y = this.px(6);
    this.c.width = this.W;
    this.c.height = MAX_HEIGHT;
    this.g = this.c.getContext("2d", { willReadFrequently: true })!;
    this.g.fillStyle = "#fff";
    this.g.fillRect(0, 0, this.W, MAX_HEIGHT);
    this.g.fillStyle = "#000";
  }

  px = (n: number) => Math.round(n * this.s);
  gap = (n: number) => (this.y += this.px(n));
  private font(family: string, size: number, weight: number, italic = false) {
    this.g.font = `${italic ? "italic " : ""}${weight} ${this.px(size)}px ${family}`;
  }
  private lineH = (size: number) => this.px(size * 1.42); // room for Thai upper/lower marks
  private base = (size: number) => this.y - this.px(size * 0.34);

  private wrap = (text: string, maxW: number) => wrapText(this.g, text, maxW);

  center(text: string, size: number, { family = this.f.sans, weight = 500, italic = false } = {}) {
    this.font(family, size, weight, italic);
    for (const l of this.wrap(text, this.W - this.pad * 2)) {
      this.y += this.lineH(size);
      this.g.fillText(l, (this.W - this.g.measureText(l).width) / 2, this.base(size));
    }
  }

  // Left text (wrapped, optionally indented) with a right-aligned value on its first line
  row(
    left: string,
    right: string | null,
    size: number,
    opts: { family?: string; weight?: number; indent?: number; rightFamily?: string; rightSize?: number; rightWeight?: number } = {},
  ) {
    const { family = this.f.sans, weight = 500, indent = 0 } = opts;
    const { rightFamily = family, rightSize = size, rightWeight = weight } = opts;
    this.font(rightFamily, rightSize, rightWeight);
    const rw = right ? this.g.measureText(right).width + this.px(14) : 0;
    this.font(family, size, weight);
    const rows = this.wrap(left, this.W - this.pad * 2 - this.px(indent) - rw);
    const h = Math.max(this.lineH(size), right ? this.lineH(rightSize) : 0);
    rows.forEach((l, i) => {
      this.y += i === 0 ? h : this.lineH(size);
      this.font(family, size, weight);
      this.g.fillText(l, this.pad + this.px(indent), this.y - this.px(size * 0.34));
      if (i === 0 && right) {
        this.font(rightFamily, rightSize, rightWeight);
        this.g.fillText(right, this.W - this.pad - this.g.measureText(right).width, this.y - this.px(size * 0.34));
      }
    });
  }

  // Three columns: qty | name (wrapped) | amount
  item(qty: string, name: string, amount: string, size: number) {
    const qtyW = this.px(56);
    this.font(this.f.mono, size, 600);
    const aw = this.g.measureText(amount).width + this.px(14);
    this.font(this.f.sans, size, 600);
    const rows = this.wrap(name, this.W - this.pad * 2 - qtyW - aw);
    rows.forEach((l, i) => {
      this.y += this.lineH(size);
      const b = this.base(size);
      this.font(this.f.sans, size, 600);
      this.g.fillText(l, this.pad + qtyW, b);
      if (i === 0) {
        this.font(this.f.mono, size, 600);
        this.g.fillText(qty, this.pad, b);
        this.g.fillText(amount, this.W - this.pad - this.g.measureText(amount).width, b);
      }
    });
  }

  rule(dashed = true) {
    this.y += this.px(9);
    this.g.fillRect(this.pad, this.y, this.W - this.pad * 2, Math.max(1, this.px(2)));
    if (dashed) {
      this.g.fillStyle = "#fff";
      for (let x = this.pad + this.px(7); x < this.W - this.pad; x += this.px(14)) this.g.fillRect(x, this.y, this.px(7), this.px(2));
      this.g.fillStyle = "#000";
    }
    this.y += this.px(9);
  }

  // Centered QR, `size` dots square
  qr(text: string, size: number) {
    const s = this.px(size);
    this.y += this.px(6);
    drawQr(this.g, text, Math.round((this.W - s) / 2), this.y, s);
    this.y += s;
  }

  // Centered picture, scaled to `widthFrac` of the paper (capped by maxH), dithered to 1-bit
  image(img: HTMLImageElement | null | undefined, widthFrac: number, maxH: number) {
    if (!img || !img.complete || !img.naturalWidth) return;
    let w = Math.round(this.W * widthFrac);
    let h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const cap = this.px(maxH);
    if (h > cap) {
      w = Math.round((w * cap) / h);
      h = cap;
    }
    const x = Math.round((this.W - w) / 2);
    this.y += this.px(6);
    this.g.drawImage(img, x, this.y, w, h);
    dither(this.g, x, this.y, w, h);
    this.y += h + this.px(6);
  }

  done(): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = this.W;
    out.height = Math.min(MAX_HEIGHT, Math.ceil(this.y + this.px(10)));
    out.getContext("2d")!.drawImage(this.c, 0, 0);
    return out;
  }
}

// Floyd–Steinberg to pure black/white, so photos and grey logos keep their shading on a 1-bit printer
function dither(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const v = lum[k] < 128 ? 0 : 255;
      const err = lum[k] - v;
      lum[k] = v;
      if (i + 1 < w) lum[k + 1] += (err * 7) / 16;
      if (j + 1 < h) {
        if (i > 0) lum[k + w - 1] += (err * 3) / 16;
        lum[k + w] += (err * 5) / 16;
        if (i + 1 < w) lum[k + w + 1] += err / 16;
      }
    }
  }
  for (let k = 0; k < w * h; k++) {
    d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = lum[k];
    d[k * 4 + 3] = 255;
  }
  g.putImageData(img, x, y);
}

// ── Ticket: for whoever makes the drinks
export function drawTicket(r: Receipt, paper: PaperWidth = 80): HTMLCanvasElement {
  const p = new Pen(paper);
  p.center(`คิวที่ ${r.queue}`, 56, { weight: 800 });
  p.gap(2);
  p.row(when(r.when), r.staff ? `พนักงาน: ${r.staff}` : null, 20, { family: p.f.mono });
  p.rule();
  for (const l of r.lines) {
    p.row(l.name, `x${l.qty}`, 34, { weight: 700, rightFamily: p.f.mono, rightWeight: 800 });
    if (l.mods.length) p.row(l.mods.join(" · "), null, 24, { weight: 500, indent: 20 });
    p.gap(6);
  }
  return p.done();
}

// ── Customer receipt, after the shop's existing layout, in Ippuku's type
export function drawReceipt(r: Receipt, paper: PaperWidth = 80, images: ReceiptImages = {}): HTMLCanvasElement {
  const p = new Pen(paper);
  const mono = { family: p.f.mono };
  p.center(`คิวที่ ${r.queue}`, 30, { weight: 700 });
  p.image(images.logo, 0.34, 200);
  p.center(r.shop, 46, { family: p.f.serif, weight: 500, italic: true });
  r.header?.forEach((h) => p.center(h, 20));
  p.gap(6);
  p.center("ใบเสร็จรับเงิน", 26, { weight: 700 });
  p.rule();

  p.row(`วันที่: ${when(r.when)}`, null, 20, mono);
  p.row(`Order #${r.queue}`, null, 20, mono);
  p.row(r.counter ? `POS: ${r.counter}` : "", r.staff ? `พนักงาน: ${r.staff}` : null, 20, mono);
  p.rule();

  p.row("Qty  รายละเอียด", "รวม", 19, { weight: 600 });
  p.gap(2);
  for (const l of r.lines) {
    p.item(String(l.qty), l.name, money(l.totalSatang).replace("฿", ""), 23);
    if (l.mods.length) p.row(l.mods.join(" · "), null, 19, { indent: 56 });
    if (l.qty > 1) p.row(`@ ${money(l.unitSatang)}`, null, 18, { indent: 56, family: p.f.mono });
    p.gap(3);
  }
  p.rule();

  if (r.discount) {
    p.row(`ส่วนลด · ${r.discount.label}`, `-${money(r.discount.satang).replace("฿", "")}`, 21, { rightFamily: p.f.mono });
    p.gap(3);
  }
  const count = r.lines.reduce((n, l) => n + l.qty, 0);
  p.row(`${count} ชิ้น   รวมทั้งสิ้น`, money(r.totalSatang), 24, { weight: 600, rightFamily: p.f.mono, rightSize: 40, rightWeight: 700 });
  p.rule();

  p.row("การชำระเงิน", null, 20, { weight: 600 });
  for (const pay of r.payments) p.row(pay.label, money(pay.amountSatang), 21, { rightFamily: p.f.mono });
  if (r.tenderSatang != null) p.row("รับเงิน", money(r.tenderSatang), 21, { rightFamily: p.f.mono });
  if (r.changeSatang != null) p.row("เงินทอน", money(r.changeSatang), 23, { weight: 700, rightFamily: p.f.mono, rightWeight: 700 });
  p.rule();

  (r.footer?.length ? r.footer : ["THANK YOU", "ENJOY YOUR DAY ♡"]).forEach((f) => p.center(f, 22));
  p.image(images.bottom, 0.3, 220);

  if (r.claim) {
    p.rule();
    p.qr(r.claim.url, 220);
    const earn = [r.claim.points > 0 ? `${r.claim.points} แต้ม` : "", r.claim.stamps ? `${r.claim.stamps} แสตมป์` : ""].filter(Boolean).join(" + ");
    p.center(`สแกนด้วย LINE รับ ${earn}`, 22, { weight: 600 });
    p.center(`หรือพิมพ์รหัส ${r.claim.code}`, 20, { family: p.f.mono });
  }
  return p.done();
}
