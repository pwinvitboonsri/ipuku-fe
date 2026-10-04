import type { CSSProperties, ReactNode } from "react";

export const inputCls =
  "w-full box-border rounded-[10px] border border-line-2 bg-card px-[13px] py-[11px] text-[14.5px] text-ink outline-none focus:border-ink-2";

export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="text-[12px] font-medium text-persimmon-2">{error}</span>
      ) : (
        hint && <span className="text-[12px] leading-[1.4] text-muted">{hint}</span>
      )}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  prefix,
  suffix,
  type,
  inputMode,
  style,
  autoFocus,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  prefix?: string;
  suffix?: string;
  type?: string;
  inputMode?: "numeric" | "decimal" | "text";
  style?: CSSProperties;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="mono absolute left-[13px] text-[14px] text-muted">{prefix}</span>}
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} ${mono ? "mono" : ""}`}
        style={{ paddingLeft: prefix ? 30 : 13, paddingRight: suffix ? 44 : 13, ...style }}
      />
      {suffix && <span className="absolute right-[13px] text-[13px] text-muted">{suffix}</span>}
    </div>
  );
}
