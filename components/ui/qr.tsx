import { useMemo } from "react";
import { qrModules } from "@/lib/qr";

// Crisp SVG QR for screens. Includes the quiet zone, so it scans on any background.
export function Qr({ value, size = 160, className = "" }: { value: string; size?: number; className?: string }) {
  const { n, path } = useMemo(() => {
    const m = qrModules(value);
    let d = "";
    m.forEach((row, r) => row.forEach((dark, c) => dark && (d += `M${c + 4} ${r + 4}h1v1h-1z`)));
    return { n: m.length + 8, path: d };
  }, [value]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" className={className} role="img" aria-label="QR code">
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
