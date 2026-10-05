"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useIngredients } from "@/lib/backoffice";
import { useMediaQuery } from "@/lib/orientation";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { ScrollRow } from "@/components/ui/scroll-row";

const NAV = [
  { id: "/backoffice/menu", label: "Menu" },
  { id: "/backoffice/groups", label: "Option groups" },
  { id: "/backoffice/inventory", label: "Inventory" },
  { id: "/backoffice/history", label: "Stock history" },
  { id: "/backoffice/shifts", label: "Shifts" },
  { id: "/backoffice/staff", label: "Staff" },
];

// Back office frame: vertical rail on wide screens (as designed), scrollable tab row otherwise.
export function BackofficeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const rail = useMediaQuery("(min-width: 1024px)", true);
  const ingredients = useIngredients();
  const low = ingredients.data?.filter((i) => i.is_active && i.stock_quantity <= i.reorder_level).length ?? 0;
  const current = NAV.find((n) => pathname.startsWith(n.id))?.id ?? NAV[0].id;
  const items = NAV.map((n) => ({ id: n.id, label: n.label, count: n.id === "/backoffice/inventory" && low ? `${low} low` : null }));

  return (
    <div className={`relative flex min-h-0 flex-1 ${rail ? "" : "flex-col"}`}>
      {rail ? (
        <nav className="w-[196px] shrink-0 border-r border-line bg-paper px-3 py-4">
          <GlassTabs vertical full radius={10} value={current} onChange={(id) => router.push(id)} items={items} />
        </nav>
      ) : (
        <nav className="shrink-0 border-b border-line bg-paper px-1.5 py-2 sm:px-3">
          <ScrollRow selected={current} className="flex">
            <div className="shrink-0 px-1.5 sm:px-0">
              <GlassTabs radius={10} value={current} onChange={(id) => router.push(id)} items={items} />
            </div>
          </ScrollRow>
        </nav>
      )}
      <div key={current} className="screen-enter relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
