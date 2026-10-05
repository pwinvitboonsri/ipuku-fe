"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const FADE = 28; // px of edge fade when there's more to scroll that way

// Horizontal scroller that fades whichever edge still has content past it,
// so a tab row cut off on a phone reads as "swipe for more" rather than broken.
// Also keeps the selected tab (aria-selected) in view when it changes.
export function ScrollRow({ children, className = "", selected }: { children: ReactNode; className?: string; selected?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    const x = tab.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    const a = x - FADE;
    const z = x + tab.offsetWidth + FADE - el.clientWidth;
    if (el.scrollLeft > a) el.scrollTo({ left: a, behavior: "smooth" });
    else if (el.scrollLeft < z) el.scrollTo({ left: z, behavior: "smooth" });
  }, [selected]);

  const mask = `linear-gradient(90deg, ${edges.left ? "transparent" : "#000"} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${edges.right ? "transparent" : "#000"} 100%)`;
  return (
    <div ref={ref} className={`no-scrollbar relative min-w-0 overflow-x-auto ${className}`} style={{ maskImage: mask, WebkitMaskImage: mask }}>
      {children}
    </div>
  );
}
