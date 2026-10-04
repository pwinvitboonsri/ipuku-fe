import type { ReactNode } from "react";

// Dense back-office table from the design. Scrolls sideways on narrow screens instead of squashing.
export const thCls = "whitespace-nowrap border-b border-line bg-paper-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-muted";
export const tdCls = "border-b border-line px-3 py-[11px] align-middle text-[13.5px] text-ink";

export function Table({ children, minWidth = 0 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="scroll overflow-x-auto rounded-[14px] border border-line bg-card">
      <table className="bo-table w-full border-collapse" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
