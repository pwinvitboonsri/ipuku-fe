// Money is integer satang (฿1 = 100) everywhere in state and on the wire.
export function money(satang: number): string {
  const neg = satang < 0;
  const baht = Math.abs(satang) / 100;
  return (neg ? "−" : "") + "฿" + baht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Short whole-baht label for quick-amount buttons, e.g. ฿1,000
export function bahtLabel(satang: number): string {
  return "฿" + Math.round(satang / 100).toLocaleString("en-US");
}

// Stock quantities are integer hundredths of the unit (150 ml = 15000).
export function qty(hundredths: number, unit: string): string {
  const n = hundredths / 100;
  const s = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (n < 0 ? "−" : "") + s + " " + unit;
}

export function toHundredths(input: string | number): number {
  return Math.round(Number(input) * 100);
}

export function clock(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}
