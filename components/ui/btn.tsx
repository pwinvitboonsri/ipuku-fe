import type { CSSProperties, ReactNode } from "react";

type Kind = "primary" | "go" | "danger" | "dangerSoft" | "secondary" | "ghost";

const KINDS: Record<Kind, string> = {
  primary: "bg-ink text-paper border-ink",
  go: "bg-matcha text-paper border-matcha",
  danger: "bg-persimmon text-white border-persimmon",
  dangerSoft: "bg-card text-persimmon-2 border-line-2",
  secondary: "bg-card text-ink border-line-2",
  ghost: "bg-paper-2 text-ink-2 border-transparent",
};

const SIZES = {
  lg: "px-5 py-4 text-[15px] rounded-[10px]",
  md: "px-4 py-[11px] text-[14px] rounded-[10px]",
  sm: "px-3 py-[7px] text-[12.5px] rounded-[8px]",
};

export function Btn({
  kind = "secondary",
  size = "md",
  full,
  disabled,
  onClick,
  type = "button",
  className = "",
  style,
  children,
}: {
  kind?: Kind;
  size?: keyof typeof SIZES;
  full?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const k = disabled ? "bg-paper-3 text-muted border-paper-3" : KINDS[kind];
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={style}
      className={`tap inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold ${k} ${SIZES[size]} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
