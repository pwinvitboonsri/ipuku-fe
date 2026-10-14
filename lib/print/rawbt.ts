// Hand a print job to the RawBT Android app (ru.a402d.rawbtprinter), which owns the
// Bluetooth link to the printer. RawBT takes binary data as `rawbt:base64,<data>`.
// The intent: form names the package, so Chrome opens RawBT directly (or its Play Store page if missing).
import { toBase64 } from "./escpos";

const PACKAGE = "ru.a402d.rawbtprinter";

export type RawbtMode = "intent" | "scheme";

export function rawbtUrl(bytes: Uint8Array, mode: RawbtMode = "intent"): string {
  const b64 = toBase64(bytes);
  return mode === "intent" ? `intent:base64,${b64}#Intent;scheme=rawbt;package=${PACKAGE};end;` : `rawbt:base64,${b64}`;
}

// Must run inside a user gesture (tap) or Chrome blocks the app switch.
export function sendToRawbt(bytes: Uint8Array, mode: RawbtMode = "intent") {
  window.location.href = rawbtUrl(bytes, mode);
}
