// ESC/POS bytes for 80 mm / 58 mm thermal printers (XPrinter and clones).
// Receipts are printed as a raster image so Thai renders with the browser's fonts —
// the printer's own Thai code pages are unreliable for vowels and tone marks.

const ESC = 0x1b;
const GS = 0x1d;

// Printable width in dots at 203 dpi: 80 mm paper → 72 mm → 576 dots, 58 mm → 48 mm → 384 dots.
export const PAPER_DOTS = { 80: 576, 58: 384 } as const;
export type PaperWidth = keyof typeof PAPER_DOTS;

const BAND_ROWS = 128; // rows per GS v 0 block; cheap printers choke on one huge image
const INK_LEVEL = 160; // luminance below this prints black (0–255)

export const escpos = {
  init: () => [ESC, 0x40],
  feed: (lines: number) => [ESC, 0x64, Math.min(255, lines)],
  cut: () => [GS, 0x56, 0x42, 0x00], // feed to the cutter and partial-cut; ignored without a cutter
  // Kick the cash drawer wired to the printer (pin 2, ~100 ms pulse)
  drawer: () => [ESC, 0x70, 0x00, 0x32, 0x32],
  text: (s: string) => Array.from(new TextEncoder().encode(s)),
};

// GS v 0: 1-bit raster, MSB = leftmost dot, rows of width/8 bytes.
export function rasterBytes(image: ImageData): number[] {
  const { width, height, data } = image;
  const rowBytes = Math.ceil(width / 8);
  const out: number[] = [];
  for (let top = 0; top < height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - top);
    out.push(GS, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, rows & 0xff, rows >> 8);
    for (let y = top; y < top + rows; y++) {
      for (let bx = 0; bx < rowBytes; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x >= width) continue;
          const i = (y * width + x) * 4;
          // Composite over white so transparent pixels stay blank
          const a = data[i + 3] / 255;
          const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a + 255 * (1 - a);
          if (lum < INK_LEVEL) byte |= 0x80 >> bit;
        }
        out.push(byte);
      }
    }
  }
  return out;
}

// One print job for one or more rendered slips (e.g. ticket then receipt), each fed and cut.
// Sent to RawBT as a single hand-off: Chrome only allows one app switch per tap.
export function printJob(canvases: HTMLCanvasElement[], opts: { cut?: boolean; drawer?: boolean } = {}): Uint8Array {
  // concat, not push(...): a raster is ~100k bytes, too many arguments for a spread call
  let out: number[] = [...escpos.init(), ...(opts.drawer ? escpos.drawer() : [])];
  for (const canvas of canvases) {
    const image = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    out = out.concat(rasterBytes(image), escpos.feed(4), opts.cut === false ? escpos.feed(2) : escpos.cut());
  }
  return Uint8Array.from(out);
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
