// Generates the PWA / favicon PNGs from the design tokens — no dependencies.
// Mark: ink tile, a paper "一" stroke (from 一服) and the matcha → yuzu → persimmon line from the login screen.
// Run: node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const INK = [0x1c, 0x18, 0x14];
const PAPER = [0xf5, 0xf1, 0xe8];
const LINE = [[0x6b, 0x7f, 0x4a], [0xd4, 0xa5, 0x37], [0xc8, 0x55, 0x3d]]; // matcha, yuzu, persimmon

const SS = 4; // supersampling for smooth edges

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Signed-distance test for a rounded rect centred at (cx, cy)
function inRoundRect(x, y, cx, cy, w, h, r) {
  const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(y - cy) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function lineColor(t) {
  return t < 0.5 ? mix(LINE[0], LINE[1], t * 2) : mix(LINE[1], LINE[2], (t - 0.5) * 2);
}

// Sample the mark in unit space (0..1). full = edge-to-edge (maskable), else rounded tile.
function sample(u, v, full) {
  const tile = full || inRoundRect(u, v, 0.5, 0.5, 1, 1, 0.225);
  if (!tile) return null;
  // content scaled into the maskable safe zone
  const s = full ? 0.72 : 1;
  const x = 0.5 + (u - 0.5) / s, y = 0.5 + (v - 0.5) / s;
  if (inRoundRect(x, y, 0.5, 0.47, 0.56, 0.085, 0.0425)) return PAPER; // 一
  if (inRoundRect(x, y, 0.5, 0.64, 0.56, 0.028, 0.014)) return lineColor((x - 0.22) / 0.56); // colour line
  return INK;
}

function render(size, full) {
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, full);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const i = (py * size + px) * 4;
      const n = SS * SS;
      out[i] = a ? Math.round(r / a) : 0;
      out[i + 1] = a ? Math.round(g / a) : 0;
      out[i + 2] = a ? Math.round(b / a) : 0;
      out[i + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, out);
}

mkdirSync("public/icons", { recursive: true });
const files = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/maskable-192.png", 192, true],
  ["public/icons/maskable-512.png", 512, true],
  ["app/icon.png", 64, false],
  ["app/apple-icon.png", 180, true], // iOS rounds the corners itself
];
for (const [path, size, full] of files) {
  writeFileSync(path, render(size, full));
  console.log("wrote", path);
}
