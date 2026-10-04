import type { ReactNode } from "react";

// Centered modal card used for every form/confirm sheet.
export function Sheet({
  title,
  sub,
  onClose,
  children,
  footer,
  width = 460,
  tone,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  tone?: "danger";
}) {
  return (
    <div
      className="modal-backdrop absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(28,24,20,0.42)" }}
      onClick={onClose}
    >
      <div
        className="modal-card flex max-h-[92%] w-full flex-col overflow-hidden rounded-[18px] bg-paper shadow-lg"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 pb-3.5 pt-4 sm:px-5 sm:pt-[18px]">
          <div className="flex-1">
            <div className={`text-[18px] font-semibold tracking-[-0.2px] ${tone === "danger" ? "text-persimmon-2" : "text-ink"}`}>{title}</div>
            {sub && <div className="mt-[3px] text-[13px] leading-[1.4] text-muted">{sub}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="tap h-8 w-8 shrink-0 rounded-full bg-paper-2 text-[16px] text-ink-2">
            ×
          </button>
        </div>
        <div className="scroll flex flex-col gap-3.5 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-line bg-paper-2 p-3 sm:p-3.5">{footer}</div>}
      </div>
    </div>
  );
}
