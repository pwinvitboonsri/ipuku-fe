"use client";

import { money } from "@/lib/format";
import type { MenuCategory, MenuProduct } from "@/lib/types";
import { usePhone } from "@/lib/orientation";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { ScrollRow } from "@/components/ui/scroll-row";
import { ItemPhoto } from "./item-photo";

// Category tabs + search. Inactive products never arrive from /menu, so they never render here.
export function CategoryTabs({
  categories,
  active,
  onChange,
  search,
  onSearch,
}: {
  categories: MenuCategory[];
  active: string;
  onChange: (id: string) => void;
  search: string | null;
  onSearch: (q: string | null) => void;
}) {
  const phone = usePhone();
  return (
    <div className="flex items-center gap-1 border-b border-line bg-paper py-2.5 pl-3 pr-1.5 sm:gap-2.5 sm:px-5 sm:pb-3 sm:pt-3.5">
      {search === null ? (
        <ScrollRow selected={active}>
          <GlassTabs size={phone ? "md" : "lg"} value={active} onChange={onChange} items={categories.map((c) => ({ id: c.id, label: c.name, count: c.products.length }))} />
        </ScrollRow>
      ) : (
        <input
          autoFocus
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search the menu"
          className="min-w-0 flex-1 rounded-full border border-line-2 bg-card px-4 py-2.5 text-[15px] text-ink outline-none"
        />
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => onSearch(search === null ? "" : null)}
        aria-label={search === null ? "Search" : "Cancel search"}
        className="tap flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2.5 text-[14px] text-muted sm:px-3.5"
      >
        {search === null ? (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Search</span>
          </>
        ) : (
          "Cancel"
        )}
      </button>
    </div>
  );
}

// Warn-only stock tag from the base recipe: "Out: Espresso beans" / "Low: Whole milk (+1)".
function StockTag({ stock }: { stock: MenuProduct["stock"] }) {
  if (stock.status === "OK") return null;
  const out = stock.status === "OUT";
  const [first, ...rest] = stock.ingredients;
  return (
    <div
      className="truncate text-[11.5px] font-semibold leading-[1.3]"
      style={{ color: out ? "var(--persimmon-2)" : "#7A5A0E" }}
      title={stock.ingredients.map((i) => `${i.status === "OUT" ? "Out" : "Low"}: ${i.name}`).join(" · ")}
    >
      {out ? "Out" : "Low"}: {first.name}
      {rest.length > 0 && <span className="font-medium opacity-75"> (+{rest.length})</span>}
    </div>
  );
}

function ItemCard({ item, onTap }: { item: MenuProduct; onTap: (p: MenuProduct) => void }) {
  const out = item.stock.status === "OUT";
  return (
    <button
      type="button"
      onClick={() => onTap(item)}
      className="tap relative flex flex-col gap-2.5 rounded-[14px] border bg-card p-3 text-left shadow-sm"
      style={{ borderColor: out ? "#E9C3B8" : item.stock.status === "LOW" ? "#EBD9A6" : "var(--line)" }}
    >
      <div style={{ opacity: out ? 0.6 : 1 }}>
        <ItemPhoto id={item.id} name={item.name} imageUrl={item.image_url} />
      </div>
      <div className="flex min-h-[44px] min-w-0 flex-col gap-0.5">
        <div className="text-[14px] font-medium leading-[1.25] tracking-[-0.1px] text-ink">{item.name}</div>
        <div className="mono mt-0.5 text-[13px] font-medium text-ink-2">{money(item.price_satang)}</div>
        <StockTag stock={item.stock} />
      </div>
      {item.groups.length > 0 && (
        <div className="absolute right-2.5 top-2.5 rounded-[4px] px-[7px] py-[3px] text-[10px] font-semibold tracking-[0.3px] text-ink-2" style={{ background: "rgba(255,255,255,0.85)" }}>
          Options
        </div>
      )}
    </button>
  );
}

export function ItemGrid({ items, gridKey, onItemTap, empty }: { items: MenuProduct[]; gridKey: string; onItemTap: (p: MenuProduct) => void; empty?: string }) {
  return (
    <div className="scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3.5 sm:px-5 sm:pt-[18px]">
      {items.length === 0 ? (
        <div className="p-10 text-center text-[14px] text-muted">{empty ?? "Nothing here."}</div>
      ) : (
        // As many ~180px columns as fit (3 on a tablet, like the design), never fewer than 2 on a phone
        <div key={gridKey} className="stagger grid gap-2.5 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(180px, calc(50% - 6px)), 1fr))" }}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onTap={onItemTap} />
          ))}
        </div>
      )}
    </div>
  );
}
