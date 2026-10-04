"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import { errorText } from "@/lib/api";
import { useMenu } from "@/lib/menu";
import { useWideLayout } from "@/lib/orientation";
import { useOnline } from "@/lib/session";
import type { MenuProduct } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Spinner } from "@/components/ui/bits";
import { CategoryTabs, ItemGrid } from "./item-grid";
import { ModifierModal } from "./modifier-modal";
import { OrderDrawer, OrderPanel } from "./order-panel";
import { PaymentScreen } from "./payment-screen";
import { SuccessScreen } from "./success-screen";

// Sell → Take payment → Paid. The step lives in the cart context so it survives switching tabs.
export function SellScreen() {
  const cart = useCart();
  const menu = useMenu();
  const stacked = !useWideLayout();
  const online = useOnline();
  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [modal, setModal] = useState<MenuProduct | null>(null);

  if (cart.step === "payment") return <PaymentScreen />;
  if (cart.step === "success" && cart.order) return <SuccessScreen order={cart.order} stockAlerts={cart.stockAlerts} onNextOrder={cart.nextOrder} />;

  if (menu.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Loading menu…" />
      </div>
    );
  }
  if (menu.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-[15px] font-semibold text-persimmon-2">Couldn&apos;t load the menu</div>
        <div className="text-[13px] text-muted">{errorText(menu.error)}</div>
        <Btn onClick={() => menu.refetch()}>Retry</Btn>
      </div>
    );
  }

  const categories = menu.data;
  const category = categories.find((c) => c.id === picked) ?? categories[0];
  const q = search?.trim().toLowerCase();
  const items = q ? categories.flatMap((c) => c.products).filter((p) => p.name.toLowerCase().includes(q)) : (category?.products ?? []);

  function tap(p: MenuProduct) {
    if (p.groups.length) setModal(p);
    else cart.add(p, [], 1);
  }

  const panelProps = {
    lines: cart.lines,
    total: cart.previewTotal,
    canPay: online,
    onQty: cart.setQty,
    onRemove: cart.remove,
    onClear: cart.clear,
    onPay: cart.charge,
  };

  const grid = (
    <div className="flex min-h-0 flex-1 flex-col">
      <CategoryTabs categories={categories} active={category?.id ?? ""} onChange={setPicked} search={search} onSearch={setSearch} />
      <ItemGrid
        items={items}
        gridKey={q ? "search" : (category?.id ?? "")}
        onItemTap={tap}
        empty={categories.length === 0 ? "No active products yet. Add some in the back office." : q ? "No products match your search." : undefined}
      />
    </div>
  );

  return (
    <div className={`relative flex min-h-0 flex-1 ${stacked ? "flex-col" : ""}`} data-screen-label={stacked ? "Sell · Stacked" : "Sell · Side by side"}>
      {stacked ? (
        <>
          {grid}
          <OrderDrawer {...panelProps} />
        </>
      ) : (
        <>
          <div className="flex w-[60%] min-h-0 flex-col">{grid}</div>
          <div className="w-[40%] min-h-0">
            <OrderPanel {...panelProps} />
          </div>
        </>
      )}
      {modal && (
        <ModifierModal
          key={modal.id}
          item={modal}
          onClose={() => setModal(null)}
          onAdd={(options, qty) => {
            cart.add(modal, options, qty);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
