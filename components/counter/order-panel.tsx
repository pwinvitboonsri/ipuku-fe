"use client";

import { useRef, useState } from "react";
import { money } from "@/lib/format";
import type { DisplayLine } from "@/lib/orders";
import { Pill } from "@/components/ui/bits";
import { ItemPhoto } from "./item-photo";
import { QtyStepper } from "./qty-stepper";

function LineItem({ line, onTap, selected }: { line: DisplayLine; onTap?: (l: DisplayLine) => void; selected: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onTap?.(line)}
      disabled={!onTap}
      className="tap flex w-full items-start gap-3 rounded-[10px] px-3.5 py-3 text-left"
      style={{
        background: selected ? "var(--paper-2)" : "transparent",
        border: selected ? "1px solid var(--line-2)" : "1px solid transparent",
        cursor: onTap ? "pointer" : "default",
      }}
    >
      <ItemPhoto id={line.productId} name={line.name} imageUrl={line.imageUrl} size="line" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[15px] font-medium text-ink">{line.name}</div>
          <div className="mono text-[14px] font-medium text-ink">{money(line.totalSatang)}</div>
        </div>
        {line.mods.length > 0 && <div className="text-[12.5px] leading-[1.4] text-muted">{line.mods.join(" · ")}</div>}
        <div className="mono mt-1 text-[11px] text-muted">
          {line.qty} × {money(line.unitSatang)}
        </div>
      </div>
    </button>
  );
}

function LineEditPopover({ line, onClose, onQty, onRemove }: { line: DisplayLine; onClose: () => void; onQty: (q: number) => void; onRemove: () => void }) {
  return (
    <div className="absolute inset-0 z-[5] flex items-end justify-center p-4" style={{ background: "rgba(28,24,20,0.18)" }} onClick={onClose}>
      <div className="modal-card flex w-full flex-col gap-3.5 rounded-2xl bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <ItemPhoto id={line.productId} name={line.name} imageUrl={line.imageUrl} size="line" />
          <div className="flex-1">
            <div className="text-[15px] font-semibold">{line.name}</div>
            <div className="text-[12px] text-muted">{line.mods.join(" · ") || "—"}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">Quantity</span>
          <QtyStepper value={line.qty} onChange={onQty} />
        </div>
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={onRemove} className="tap flex-1 rounded-[10px] bg-paper-2 p-3 text-[14px] font-semibold text-persimmon">
            Remove
          </button>
          <button type="button" onClick={onClose} className="tap flex-1 rounded-[10px] bg-ink p-3 text-[14px] font-semibold text-paper">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyOrderState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-2">
        <span className="serif-i text-[32px] text-muted">一</span>
      </div>
      <div>
        <div className="text-[16px] font-medium text-ink">No items yet</div>
        <div className="mt-1 max-w-[220px] text-[13px] text-muted">Tap items from the menu to start an order.</div>
      </div>
    </div>
  );
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="text-ink-2">
    <rect x="2.5" y="5" width="7" height="6" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

// Cart (editable) or a server order (locked, during payment). Locked totals come from the server.
export function OrderPanel({
  lines,
  total,
  locked,
  orderNumber,
  canPay,
  onQty,
  onRemove,
  onClear,
  onPay,
}: {
  lines: DisplayLine[];
  total: number;
  locked?: boolean;
  orderNumber?: number | null;
  canPay?: boolean;
  onQty?: (key: string, q: number) => void;
  onRemove?: (key: string) => void;
  onClear?: () => void;
  onPay?: () => void;
}) {
  const [selKey, setSelKey] = useState<string | null>(null);
  const selected = !locked ? lines.find((l) => l.key === selKey) : undefined;
  const hasLines = lines.length > 0;
  const payable = hasLines && !!canPay;

  return (
    <div className="relative flex h-full flex-col border-l border-line bg-paper">
      <div className="flex items-center justify-between gap-2.5 border-b border-line bg-paper px-4 pb-3.5 pt-4" style={{ touchAction: "none" }}>
        {locked && orderNumber ? (
          <div className="flex items-baseline gap-2.5">
            <span className="text-[11px] font-semibold tracking-[1.2px] text-muted">QUEUE</span>
            <span className="mono text-[24px] font-semibold">#{orderNumber}</span>
            <Pill tone="OPEN">Open</Pill>
          </div>
        ) : (
          <div className="flex flex-col leading-[1.25]">
            <span className="text-[16px] font-semibold">New order</span>
            <span className="text-[11.5px] text-muted">Queue number assigned at charge</span>
          </div>
        )}
        <span className="whitespace-nowrap text-[12px] text-muted">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>

      <div className="scroll min-h-0 flex-1 overflow-y-auto px-1 py-1.5" style={{ opacity: locked ? 0.92 : 1, touchAction: "pan-y" }}>
        {!hasLines ? (
          <EmptyOrderState />
        ) : (
          <div className="flex flex-col gap-0.5">
            {lines.map((line) => (
              <div key={line.key} className="line-in">
                <LineItem line={line} onTap={locked ? undefined : (l) => setSelKey(l.key)} selected={selKey === line.key} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-line px-4 py-3">
        <div className="flex justify-between text-[18px] font-semibold text-ink">
          <span>Total</span>
          <span key={total} className="mono num-tick">
            {money(total)}
          </span>
        </div>
        <div className="text-[11.5px] text-muted">{locked && orderNumber ? "Confirmed by server · VAT included" : "Preview · VAT included · server confirms at charge"}</div>
      </div>

      {locked ? (
        <div className="flex items-center gap-2.5 border-t border-line bg-paper-2 p-4">
          <LockIcon />
          <div className="flex flex-1 flex-col leading-[1.25]">
            <span className="text-[13px] font-semibold">{orderNumber ? "Order created · can't be edited" : "Sending to server…"}</span>
            <span className="text-[11.5px] text-muted">{orderNumber ? "To change it, void and start again" : "Cart is held until the order is created"}</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-2.5 border-t border-line bg-paper-2 p-3.5">
          <button
            type="button"
            onClick={onClear}
            disabled={!hasLines}
            className="tap rounded-[12px] border border-line-2 bg-card px-[18px] py-[18px] text-[14px] font-semibold"
            style={{ color: hasLines ? "var(--persimmon)" : "var(--muted-2)" }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onPay}
            disabled={!payable}
            className="tap flex flex-1 items-center justify-between rounded-[12px] p-[18px] text-[16px] font-semibold"
            style={{ background: payable ? "var(--ink)" : "var(--paper-3)", color: payable ? "var(--paper)" : "var(--muted)" }}
          >
            <span>{hasLines && !canPay ? "Charging paused · offline" : "Charge"}</span>
            <span key={total} className="mono num-tick text-[16px]">
              {money(total)}
            </span>
          </button>
        </div>
      )}

      {selected && onQty && onRemove && (
        <LineEditPopover
          line={selected}
          onClose={() => setSelKey(null)}
          onQty={(q) => onQty(selected.key, q)}
          onRemove={() => {
            onRemove(selected.key);
            setSelKey(null);
          }}
        />
      )}
    </div>
  );
}

const OPEN_SWIPE = 24; // px up on the bar to open
const CLOSE_DRAG = 120; // px down on the sheet to close…
const CLOSE_FLICK = 0.6; // …or a flick faster than this (px/ms)
const DRAG_ZONE = 96; // top of the sheet (handle strip 22px + order header) that can be grabbed

// Stacked layouts (portrait tablet, phone): collapsed ink bar at the bottom that expands into a
// sheet with the full order panel. Also used read-only on the payment screen.
// Touch: tap or swipe the bar up to open; drag the sheet's top down (or flick) to close.
export function OrderDrawer(props: Parameters<typeof OrderPanel>[0]) {
  const [expanded, setExpanded] = useState(false);
  const [dy, setDy] = useState(0); // live drag offset of the open sheet
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const barSwipe = useRef<{ id: number; y: number } | null>(null);
  const sheetDrag = useRef<{ id: number; y: number; t: number } | null>(null);
  const count = props.lines.reduce((s, l) => s + l.qty, 0);
  const title = props.locked && props.orderNumber ? `ORDER #${props.orderNumber}` : "NEW ORDER";

  function close() {
    // Slide out, then unmount
    setClosing(true);
    setTimeout(() => {
      setExpanded(false);
      setClosing(false);
      setDy(0);
    }, 220);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        onPointerDown={(e) => (barSwipe.current = { id: e.pointerId, y: e.clientY })}
        onPointerMove={(e) => {
          const s = barSwipe.current;
          if (s && s.id === e.pointerId && s.y - e.clientY > OPEN_SWIPE) {
            barSwipe.current = null;
            setExpanded(true);
          }
        }}
        onPointerUp={() => (barSwipe.current = null)}
        onPointerCancel={() => (barSwipe.current = null)}
        className="tap relative flex w-full shrink-0 items-center justify-between bg-ink px-4 pb-3.5 pt-5 text-left text-paper sm:px-5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)", touchAction: "none" }}
      >
        <div className="absolute left-1/2 top-[7px] h-1 w-[34px] -translate-x-1/2 rounded-sm" style={{ background: "rgba(245,241,232,0.3)" }} />
        <div>
          <div className="text-[11px] font-semibold tracking-[1px]" style={{ color: "rgba(245,241,232,0.6)" }}>
            {title}
          </div>
          <div className="mt-0.5 text-[15px] font-medium">
            {count} {count === 1 ? "item" : "items"} · swipe up to review
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="mono text-[18px] font-semibold">{money(props.total)}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: "rotate(180deg)" }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: "rgba(28,24,20,0.25)", opacity: closing ? 0 : 1, transition: "opacity 220ms ease" }}
      onClick={close}
    >
      <div className="flex-1" />
      <div
        className="relative flex max-h-[88%] min-h-[60%] flex-col overflow-hidden rounded-t-[18px] bg-paper"
        style={{
          boxShadow: "0 -10px 40px rgba(28,24,20,0.18)",
          animation: "drawerUp 280ms cubic-bezier(.2,.7,.2,1)",
          transform: closing ? "translateY(100%)" : `translateY(${dy}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(.2,.7,.2,1)",
          // The sheet owns touch drags (the browser would otherwise claim a pull-down and cancel it).
          // The item list is its own scroll container, so it still scrolls normally.
          touchAction: "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          const top = e.currentTarget.getBoundingClientRect().top;
          if (e.clientY - top > DRAG_ZONE) return; // below the header: normal taps and list scrolling
          sheetDrag.current = { id: e.pointerId, y: e.clientY, t: e.timeStamp };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = sheetDrag.current;
          if (!d || d.id !== e.pointerId) return;
          setDy(Math.max(0, e.clientY - d.y));
        }}
        onPointerUp={(e) => {
          const d = sheetDrag.current;
          if (!d || d.id !== e.pointerId) return;
          sheetDrag.current = null;
          setDragging(false);
          const moved = Math.max(0, e.clientY - d.y);
          const speed = moved / Math.max(1, e.timeStamp - d.t);
          if (moved > CLOSE_DRAG || (moved > 16 && speed > CLOSE_FLICK)) close();
          else setDy(0);
        }}
        onPointerCancel={() => {
          sheetDrag.current = null;
          setDragging(false);
          setDy(0);
        }}
      >
        <button type="button" aria-label="Collapse" onClick={close} className="absolute left-1/2 top-2 z-[2] flex h-[18px] w-11 -translate-x-1/2 items-center justify-center">
          <div className="h-1 w-10 rounded-sm bg-line-2" />
        </button>
        <div className="h-[22px] shrink-0" />
        <div className="min-h-0 flex-1">
          <OrderPanel
            {...props}
            onPay={() => {
              setExpanded(false);
              props.onPay?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}
