"use client";

import { uploadImage } from "@/lib/image-upload";
import type { PrintImage } from "./settings";

const PRINT_MAX_W = 576; // full 80 mm width in dots; the receipt scales it down
const PRINT_MAX_H = 576;

// Decoded images by data URL. Printing draws synchronously right after a tap, so the
// pictures have to be decoded beforehand — `printImage` starts it and returns null until ready.
const cache = new Map<string, HTMLImageElement>();

export function printImage(img: PrintImage | null | undefined): HTMLImageElement | null {
  if (!img?.data) return null;
  let el = cache.get(img.data);
  if (!el) {
    el = new Image();
    el.src = img.data;
    cache.set(img.data, el);
  }
  return el.complete && el.naturalWidth ? el : null;
}

export async function decodePrintImage(img: PrintImage | null | undefined) {
  if (!img?.data) return;
  printImage(img);
  await cache.get(img.data)!.decode().catch(() => {});
}

const kind = (file: File) => file.type || file.name.split(".").pop()?.toLowerCase() || "unknown";

// <img> first; createImageBitmap as a second try (it reads some files <img> rejects).
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      console.error("[receipt image] can't decode", { name: file.name, type: file.type, bytes: file.size });
      throw new Error(
        /heic|heif/i.test(kind(file))
          ? "This is an iPhone HEIC photo, which Android can't open — save it as PNG or JPEG first"
          : `This tablet can't open that picture (${kind(file)}) — use a PNG or JPEG`,
      );
    }
  } finally {
    // Safe: the decoded <img> keeps its pixels after the blob URL is released
    URL.revokeObjectURL(url);
  }
}

// Draw onto white (no transparency), at most maxW×maxH
function flatten(img: CanvasImageSource & { width: number; height: number }, maxW: number, maxH: number, grey: boolean) {
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  if (grey) g.filter = "grayscale(1)";
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Logo / bottom picture. Decoded once here, so whatever this tablet can read also uploads:
// a grey PNG ≤576 px stays on the tablet for printing, a JPEG ≤800 px goes to R2.
export async function preparePrintImage(file: File): Promise<PrintImage> {
  const img = await decode(file);
  const data = flatten(img, PRINT_MAX_W, PRINT_MAX_H, true).toDataURL("image/png");
  const blob = await new Promise<Blob | null>((r) => flatten(img, 800, 800, false).toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("Couldn't process the picture on this tablet");
  const url = await uploadImage(new File([blob], "receipt-image.jpg", { type: "image/jpeg" }));
  return { url, data };
}
