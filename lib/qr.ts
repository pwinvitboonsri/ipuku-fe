import qrcode from "qrcode-generator";

// QR modules for a URL or code: true = dark. Type 0 picks the smallest size that fits.
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// Draws the QR with a 4-module quiet zone into a size×size square (printing: whole dots per module)
export function drawQr(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const m = qrModules(text);
  const cells = m.length + 8;
  const dot = Math.max(1, Math.floor(size / cells));
  const off = Math.floor((size - dot * cells) / 2) + dot * 4;
  g.fillStyle = "#fff";
  g.fillRect(x, y, size, size);
  g.fillStyle = "#000";
  m.forEach((row, r) => row.forEach((dark, c) => dark && g.fillRect(x + off + c * dot, y + off + r * dot, dot, dot)));
}
