"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ScrollRow } from "./scroll-row";

export type GlassItem<T extends string> = { id: T; label: ReactNode; badge?: number; count?: ReactNode };

type Rect = { x: number; y: number; w: number; h: number };

const SPRING = "cubic-bezier(.3,1.3,.45,1)";
// After a drag the lens is already near its target: glide the rest of the way, no overshoot
const SETTLE = "240ms cubic-bezier(.2,.8,.2,1)";
const PAD = { lg: "12px 20px", md: "8px 16px", sm: "6px 12px" };
const FS = { lg: 16, md: 13.5, sm: 12.5 };

const DRAG_SLOP = 6; // px of movement before a press on the lens becomes a drag

// Liquid-glass tabs: a frosted lens slides + stretches to the selected item.
// Touch: tap any item, or grab the lens and slide — it follows the finger and snaps to the item you let go on.
// Only the selected item starts a drag (touch-action: none there), so swiping elsewhere still scrolls the row.
export function GlassTabs<T extends string>({
  items,
  value,
  onChange,
  size = "md",
  full,
  vertical,
  radius = 999,
  track = true,
}: {
  items: GlassItem<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  vertical?: boolean;
  radius?: number;
  track?: boolean;
}) {
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const prev = useRef(value);
  const [ind, setInd] = useState<Rect | null>(null);
  const [dir, setDir] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [ready, setReady] = useState(false);
  // Live lens while dragging, plus the item currently under the finger
  const [drag, setDrag] = useState<{ rect: Rect; over: T } | null>(null);
  const press = useRef<{ id: number; start: number; dragging: boolean; over: T } | null>(null);
  // Target picked by a drag, shown until the parent's `value` catches up (it may navigate first)
  const [pending, setPending] = useState<T | null>(null);
  const [settling, setSettling] = useState(false);
  const draggedTo = useRef<T | null>(null);
  // Any new value from the parent replaces a pending drag target (derived-state reset during render)
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    if (pending !== null) setPending(null);
  }
  const shown = pending ?? value;
  const suppressClick = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sig = items.map((i) => `${i.id}|${i.badge ?? ""}|${i.count ?? ""}`).join();

  useLayoutEffect(() => {
    const measure = () => {
      const b = btns.current[shown];
      if (b) setInd({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight });
    };
    measure();
    if (prev.current !== value) {
      const ids = items.map((i) => i.id);
      const fwd = ids.indexOf(value) > ids.indexOf(prev.current);
      // A drag already showed the motion — skip the squish so the lens doesn't jolt on arrival
      setDir(draggedTo.current === value ? null : vertical ? (fwd ? "d" : "u") : fwd ? "r" : "l");
      draggedTo.current = null;
      prev.current = value;
    }
    const r = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    Object.values(btns.current).forEach((el) => el && ro.observe(el));
    return () => {
      cancelAnimationFrame(r);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig captures item changes
  }, [value, sig, vertical, shown]);

  const inner = radius === 999 ? 999 : Math.max(radius - 3, 4);

  // Pointer position along the axis, in the same coordinates as the buttons' offsetLeft/Top
  const axisPos = (e: ReactPointerEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    return vertical ? e.clientY - r.top : e.clientX - r.left;
  };
  const span = (b: HTMLButtonElement) => (vertical ? [b.offsetTop, b.offsetTop + b.offsetHeight] : [b.offsetLeft, b.offsetLeft + b.offsetWidth]);

  // Lens centred on the finger, sized like the item under it, kept inside the first..last item
  function lensAt(pos: number) {
    const list = items.map((i) => ({ id: i.id, b: btns.current[i.id] })).filter((x): x is { id: T; b: HTMLButtonElement } => !!x.b);
    if (!list.length) return null;
    const first = span(list[0].b)[0];
    const last = span(list[list.length - 1].b)[1];
    const clamped = Math.min(Math.max(pos, first), last - 1);
    const hit = list.find((x) => {
      const [a, z] = span(x.b);
      return clamped >= a && clamped < z;
    }) ?? list[list.length - 1];
    const b = hit.b;
    const size = vertical ? b.offsetHeight : b.offsetWidth;
    const start = Math.min(Math.max(clamped - size / 2, first), last - size);
    const rect = vertical ? { x: b.offsetLeft, y: start, w: b.offsetWidth, h: size } : { x: start, y: b.offsetTop, w: size, h: b.offsetHeight };
    return { rect, over: hit.id };
  }

  function onPointerDown(e: ReactPointerEvent, id: T) {
    if (id !== value || e.button !== 0) return;
    setPressed(true);
    press.current = { id: e.pointerId, start: axisPos(e), dragging: false, over: id };
    rootRef.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const pos = axisPos(e);
    if (!p.dragging && Math.abs(pos - p.start) < DRAG_SLOP) return;
    p.dragging = true;
    const next = lensAt(pos);
    if (!next) return;
    if (next.over !== p.over) {
      p.over = next.over;
      navigator.vibrate?.(6); // light tick on Android; ignored elsewhere
    }
    setDrag(next);
  }
  function endPress(e: ReactPointerEvent, commit: boolean) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    setPressed(false);
    if (!p.dragging) return; // a plain tap — the button's onClick handles it
    suppressClick.current = true;
    const target = commit ? p.over : value;
    // Hand the lens straight from the finger to the target's slot (no detour via the old tab)
    const b = btns.current[target];
    if (b) setInd({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight });
    setSettling(true);
    setTimeout(() => setSettling(false), 260);
    setDrag(null);
    if (target !== value) {
      draggedTo.current = target;
      setPending(target);
      onChange(target);
    }
  }

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPress(e, true)}
      onPointerCancel={(e) => endPress(e, false)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        gap: vertical ? 2 : 0,
        padding: 3,
        borderRadius: radius,
        width: full && !vertical ? "100%" : undefined,
        boxSizing: "border-box",
        background: track ? "var(--paper-2)" : "transparent",
        boxShadow: track ? "inset 0 1px 2px rgba(28,24,20,0.07), inset 0 0 0 1px rgba(28,24,20,0.03)" : "none",
      }}
    >
      {ind && (
        <div
          style={{
            position: "absolute",
            left: (drag?.rect ?? ind).x,
            top: (drag?.rect ?? ind).y,
            width: (drag?.rect ?? ind).w,
            height: (drag?.rect ?? ind).h,
            borderRadius: inner,
            pointerEvents: "none",
            // While dragging, the lens tracks the finger 1:1 and only its size eases between items
            transition: drag
              ? "width 160ms ease, height 160ms ease"
              : settling
                ? `left ${SETTLE}, top ${SETTLE}, width ${SETTLE}, height ${SETTLE}`
                : ready
                ? `left 520ms ${SPRING}, top 520ms ${SPRING}, width 520ms ${SPRING}, height 520ms ${SPRING}`
                : "none",
          }}
        >
          <div
            key={value}
            className={dir && !drag && !settling ? `glass-squish-${dir}` : ""}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: inner,
              transform: drag ? "scale(1.06)" : pressed ? "scale(0.95)" : "scale(1)",
              transition: "transform 260ms cubic-bezier(.3,1.5,.5,1)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.78) 55%, rgba(250,247,240,0.86) 100%)",
              backdropFilter: "blur(10px) saturate(1.8)",
              WebkitBackdropFilter: "blur(10px) saturate(1.8)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow:
                "0 1px 1px rgba(28,24,20,0.05), 0 6px 16px -4px rgba(28,24,20,0.16), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 1px rgba(28,24,20,0.05)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "10%",
                right: "10%",
                top: 1,
                height: "42%",
                maxHeight: 18,
                borderRadius: 999,
                background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
              }}
            />
          </div>
        </div>
      )}
      {items.map((it) => {
        const on = it.id === value;
        const lit = drag ? drag.over === it.id : it.id === shown;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={on}
            ref={(el) => {
              btns.current[it.id] = el;
            }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setPending(null);
              onChange(it.id);
            }}
            onPointerDown={(e) => onPointerDown(e, it.id)}
            style={{
              // The selected item owns horizontal/vertical drags; others leave touch scrolling to the browser
              touchAction: on ? "none" : "manipulation",
              userSelect: "none",
              WebkitUserSelect: "none",
              position: "relative",
              zIndex: 1,
              flex: full && !vertical ? 1 : undefined,
              padding: PAD[size],
              borderRadius: inner,
              fontSize: FS[size],
              fontWeight: 600,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: vertical ? "flex-start" : "center",
              gap: 7,
              textAlign: "left",
              color: lit ? "var(--ink)" : "var(--muted)",
              transition: "color 280ms ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {it.label}
            {it.count != null && (
              <span className="mono" style={{ fontSize: 11, fontWeight: 500, opacity: on ? 0.7 : 0.55, marginLeft: vertical ? "auto" : 0 }}>
                {it.count}
              </span>
            )}
            {!!it.badge && it.badge > 0 && (
              <span
                className="mono"
                style={{
                  background: "var(--yuzu)",
                  color: "var(--ink)",
                  borderRadius: 999,
                  fontSize: 11,
                  padding: "1px 7px",
                  transition: "transform 300ms cubic-bezier(.3,1.5,.5,1)",
                  transform: on ? "scale(1)" : "scale(0.92)",
                }}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return <GlassTabs items={options.map((o) => ({ id: o.value, label: o.label }))} value={value} onChange={onChange} size={size} full radius={12} />;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode; count?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollRow selected={value} className="flex max-w-full">
      <GlassTabs items={options.map((o) => ({ id: o.value, label: o.label, count: o.count }))} value={value} onChange={onChange} size="sm" />
    </ScrollRow>
  );
}
