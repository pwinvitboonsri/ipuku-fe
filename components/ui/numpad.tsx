import type { ReactNode } from "react";

function Key({ children, onTap, accent }: { children: ReactNode; onTap: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`tap mono flex flex-1 items-center justify-center rounded-[12px] border border-line text-[22px] font-medium text-ink ${accent ? "bg-paper-2" : "bg-card"}`}
    >
      {children}
    </button>
  );
}

// Height-flexible keypad: keys stretch to fill the rows. Digits are whole baht.
export function Numpad({ onDigit, onDouble, onBack }: { onDigit: (d: number) => void; onDouble: () => void; onBack: () => void }) {
  const rows = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {rows.map((r) => (
        <div key={r[0]} className="flex min-h-0 flex-1 gap-2">
          {r.map((d) => (
            <Key key={d} onTap={() => onDigit(d)}>
              {d}
            </Key>
          ))}
        </div>
      ))}
      <div className="flex min-h-0 flex-1 gap-2">
        <Key onTap={onDouble} accent>
          00
        </Key>
        <Key onTap={() => onDigit(0)}>0</Key>
        <button
          type="button"
          onClick={onBack}
          aria-label="Backspace"
          className="tap flex flex-1 items-center justify-center rounded-[12px] border border-line bg-paper-2 text-ink-2"
        >
          <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
            <path d="M7 1L1 9l6 8h13a1 1 0 001-1V2a1 1 0 00-1-1H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M11 6l5 6M16 6l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Keypad entry in whole baht, stored as satang. Returns the next value or the old one if over the cap.
export const keypad = {
  push: (satang: number, d: number, capBaht: number) => {
    const next = Math.floor(satang / 100) * 10 + d;
    return next > capBaht ? satang : next * 100;
  },
  double: (satang: number, capBaht: number) => {
    const next = Math.floor(satang / 100) * 100;
    return next > capBaht ? satang : next * 100;
  },
  back: (satang: number) => Math.floor(satang / 1000) * 100,
};
