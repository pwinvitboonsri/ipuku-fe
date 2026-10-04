export function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const btn = "tap flex h-7 w-7 items-center justify-center rounded-full bg-card font-semibold text-ink";
  return (
    <div className="inline-flex items-center rounded-full bg-paper-2 p-[3px]">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(1, value - 1))} className={btn}>
        −
      </button>
      <span className="mono w-8 text-center text-[14px] font-medium">{value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)} className={btn}>
        +
      </button>
    </div>
  );
}
