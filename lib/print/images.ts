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

// Grey PNG (white under any transparency), at most 576×576 — small enough to keep on the tablet.
async function printCopy(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, PRINT_MAX_W / img.naturalWidth, PRINT_MAX_H / img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.filter = "grayscale(1)";
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Logo / bottom picture: upload the original to R2 and keep a print-ready copy on the tablet.
export async function preparePrintImage(file: File): Promise<PrintImage> {
  const [url, data] = await Promise.all([uploadImage(file), printCopy(file)]);
  return { url, data };
}
