"use client";

import { api } from "./api";

// Product photos: resized on the device, then PUT straight to Cloudflare R2 with a URL
// the backend signs (POST /product/image-upload). The file never goes through Next or Nest.

const MAX_SIDE = 800;
const MAX_BYTES = 1_048_576; // matches the backend's limit

type Signed = { upload_url: string; headers: Record<string, string>; public_url: string; expires_in: number };

const log = (...args: unknown[]) => console.info("[photo upload]", ...args);

// R2 answers errors as XML: <Error><Code>AccessDenied</Code><Message>…</Message></Error>
async function r2Error(res: Response) {
  const text = await res.text().catch(() => "");
  const tag = (t: string) => text.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
  return { code: tag("Code") ?? `HTTP ${res.status}`, message: tag("Message") ?? text.slice(0, 200) };
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Longest side → 800 px, WebP (JPEG where the browser can't encode WebP, e.g. older Safari).
// Decoding through <img> also handles iPad HEIC photos and applies EXIF rotation.
export async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("Couldn't read that image — try a JPEG or PNG");
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the image on this device");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let blob = await toBlob(canvas, "image/webp", 0.82);
    // toBlob silently falls back to PNG when WebP isn't supported
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
    if (!blob) throw new Error("Couldn't process the image on this device");
    if (blob.size > MAX_BYTES) throw new Error("Image is still too large after resizing");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resize → sign → PUT to R2. Returns the public URL to save as the product's image_url.
export async function uploadProductImage(file: File): Promise<string> {
  log("picked", { name: file.name, type: file.type, bytes: file.size });
  const blob = await resizeImage(file);
  log("resized", { type: blob.type, bytes: blob.size });

  let signed: Signed;
  try {
    signed = await api.post<Signed>("/product/image-upload", { content_type: blob.type, size: blob.size });
  } catch (err) {
    console.error("[photo upload] backend refused to sign the upload", err);
    throw err;
  }
  const target = new URL(signed.upload_url);
  log("signed", { host: target.host, key: target.pathname, public_url: signed.public_url });

  let res: Response;
  try {
    // content-length is set by the browser from the blob — it must match the signed size
    res = await fetch(signed.upload_url, { method: "PUT", headers: signed.headers, body: blob });
  } catch (err) {
    // fetch only throws on network errors, and a CORS block looks exactly like one
    console.error(
      `[photo upload] PUT to ${target.host} was blocked before R2 answered. Usually the bucket's CORS policy doesn't allow origin ${location.origin} (method PUT, headers content-type, cache-control). See the red CORS line above for the browser's reason.`,
      err,
    );
    throw new Error(`Upload blocked — the storage bucket doesn't allow ${location.origin} yet (CORS)`);
  }
  if (!res.ok) {
    const { code, message } = await r2Error(res);
    console.error(`[photo upload] R2 rejected the PUT: ${res.status} ${code} — ${message}`);
    throw new Error(code === "AccessDenied" ? "Storage refused the upload (AccessDenied) — check the R2 API token" : `Storage rejected the upload (${code})`);
  }
  log("uploaded", signed.public_url);
  return signed.public_url;
}
