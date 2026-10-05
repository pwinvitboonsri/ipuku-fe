import type { ReactNode } from "react";
import { ScrollRow } from "./scroll-row";

// Dense back-office table from the design. Scrolls sideways on narrow screens instead of squashing;
// the edge fade shows when there are more columns off to one side.
export const thCls = "whitespace-nowrap border-b border-line bg-paper-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-muted";
export const tdCls = "border-b border-line px-3 py-[11px] align-middle text-[13.5px] text-ink";

export function Table({ children, minWidth = 0 }: { children: ReactNode; minWidth?: number }) {
  return (
    // Flex column so that when a screen squeezes the table, the inner scroller (not this frame) takes the cut and scrolls
    <div className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-card">
      <ScrollRow bar className="min-h-0">
        <table className="bo-table w-full border-collapse" style={{ minWidth }}>
          {children}
        </table>
      </ScrollRow>
    </div>
  );
}
