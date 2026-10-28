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
import { RewardScanSheet } from "./reward-scan-sheet";
import { LinePickSheet, ProductPickSheet, UnusedRewardSheet, type LineChoice } from "./reward-pickers";
import { panelReward, type RewardAction } from "@/lib/loyalty";
import { SuccessScreen } from "./success-screen";

// Sell → Take payment → Paid. The step lives in the cart context so it survives switching tabs.
export function SellScreen() {
  const cart = useCart();
  const menu = useMenu();
  const stacked = !useWideLayout();
  const online = useOnline();
  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [modal, setModal] = useState<{ product: MenuProduct; note?: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  // after a reward is added: pick the free item / the drink for the free option; or Charge with it unused
  const [pick, setPick] = useState<{ reward: string; action: Extract<RewardAction, { kind: "pick-product" | "pick-line" }> } | null>(null);
  const [unused, setUnused] = useState(false);

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

  function tap(p: MenuProduct, note?: string) {
    if (p.groups.length) setModal({ product: p, note });
    else cart.add(p, [], 1);
  }

  // the free option replaces whatever that group had on one unit of the line
  function giveOption(c: LineChoice) {
    const line = cart.lines.find((l) => l.key === c.lineKey);
    if (!line) return;
    const all = c.product.groups.flatMap((g) => g.options);
    const kept = all.filter((o) => line.optionIds.includes(o.id) && !c.group.options.some((g) => g.id === o.id));
    cart.setLineOptions(c.lineKey, c.product, [...kept, c.option]);
  }

  function rewardAdded(name: string, action: RewardAction | null) {
    setScanning(false);
    if (!action) return;
    if (action.kind === "add") tap(action.product, "FREE WITH REWARD · EXTRAS CHARGED");
    else if (action.kind === "add-option") giveOption(action);
    else setPick({ reward: name, action });
  }

  const rewardPanel = panelReward(null, cart.reward, cart.rewardDiscount, cart.lines);

  const panelProps = {
    lines: cart.lines,
    total: cart.previewTotal,
    canPay: online,
    onQty: cart.setQty,
    onRemove: cart.remove,
    onClear: cart.clear,
    // a reward that still doesn't apply is checked before Charge
    onPay: () => (cart.reward && cart.rewardDiscount === null ? setUnused(true) : cart.charge()),
    reward: rewardPanel,
    onScanReward: () => setScanning(true),
    onRemoveReward: cart.releaseReward,
  };

  const grid = (
    <div className="flex min-h-0 flex-1 flex-col">
      <CategoryTabs categories={categories} active={category?.id ?? ""} onChange={setPicked} search={search} onSearch={setSearch} />
      <ItemGrid
        items={items}
        gridKey={q ? "search" : (category?.id ?? "")}
        onItemTap={(p) => tap(p)}
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
      {scanning && <RewardScanSheet onClose={() => setScanning(false)} onApplied={(r, action) => rewardAdded(r.reward_name, action)} />}
      {pick?.action.kind === "pick-product" && (
        <ProductPickSheet
          reward={pick.reward}
          products={pick.action.products}
          onClose={() => setPick(null)}
          onPick={(p) => {
            setPick(null);
            tap(p, "FREE WITH REWARD · EXTRAS CHARGED");
          }}
        />
      )}
      {pick?.action.kind === "pick-line" && (
        <LinePickSheet
          reward={pick.reward}
          choices={pick.action.choices}
          lines={cart.lines}
          onClose={() => setPick(null)}
          onPick={(c) => {
            setPick(null);
            giveOption(c);
          }}
        />
      )}
      {unused && cart.reward && (
        <UnusedRewardSheet
          reward={cart.reward.reward_name}
          needs={rewardPanel?.needs}
          onBack={() => setUnused(false)}
          onRelease={() => {
            setUnused(false);
            cart.releaseReward();
            cart.charge({ withoutReward: true });
          }}
        />
      )}
      {modal && (
        <ModifierModal
          key={modal.product.id}
          item={modal.product}
          note={modal.note}
          onClose={() => setModal(null)}
          onAdd={(options, qty) => {
            cart.add(modal.product, options, qty);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
