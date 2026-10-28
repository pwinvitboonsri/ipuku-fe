import { money } from "./format";
import type { DisplayLine } from "./orders";
import type { LoyaltyCurrency, MenuCategory, MenuGroup, MenuOption, MenuProduct, Order, ValidatedReward } from "./types";

// A cart line as the discount rules see it
export type PreviewLine = Pick<DisplayLine, "productId" | "unitSatang" | "qty"> & { categoryId?: string | null; optionDeltas?: { id: string; delta: number }[] };
export type PreviewResult = { ok: true; amount: number } | { ok: false; reason: "ITEM_MISSING" | "MIN_SPEND" };

const cap = (amount: number, max: number | null, subtotal: number) => Math.max(0, Math.min(amount, max ?? amount, subtotal));

// Preview of the discount a reward gives this cart — a port of the API's rules (ipuku-be reward-discount.function.ts).
// The API decides the real amount at order create; lines restored from an order may lack a category.
export function rewardPreviewResult(reward: ValidatedReward, lines: PreviewLine[], subtotal: number): PreviewResult {
  if (reward.min_spend_satang && subtotal < reward.min_spend_satang) return { ok: false, reason: "MIN_SPEND" };
  const filtered = reward.product_ids.length + reward.category_ids.length > 0;
  const eligible = filtered ? lines.filter((l) => reward.product_ids.includes(l.productId) || (l.categoryId != null && reward.category_ids.includes(l.categoryId))) : lines;

  switch (reward.type) {
    case "FIXED_DISCOUNT":
      return { ok: true, amount: cap(reward.discount_satang ?? 0, null, subtotal) };
    case "FREE_ITEM": {
      // base price only: paid extras (size-up, oat milk) stay on the bill
      const prices = lines.filter((l) => isFreeItem(reward, l.productId, l.categoryId)).map(basePrice);
      return prices.length ? { ok: true, amount: cap(Math.max(...prices), reward.max_discount_satang, subtotal) } : { ok: false, reason: "ITEM_MISSING" };
    }
    case "PERCENT_OFF": {
      if (!eligible.length) return { ok: false, reason: "ITEM_MISSING" };
      const base = filtered ? eligible.reduce((n, l) => n + l.unitSatang * l.qty, 0) : subtotal;
      return { ok: true, amount: cap(Math.floor((base * (reward.percent ?? 0)) / 100), reward.max_discount_satang, subtotal) };
    }
    case "FREE_OPTION": {
      const deltas = eligible.flatMap((l) => (l.optionDeltas ?? []).filter((o) => reward.option_ids.includes(o.id)).map((o) => o.delta));
      return deltas.length ? { ok: true, amount: cap(Math.max(...deltas), reward.max_discount_satang, subtotal) } : { ok: false, reason: "ITEM_MISSING" };
    }
    case "BUY_X_GET_Y": {
      const buy = reward.buy_qty ?? 1;
      const get = reward.get_qty ?? 1;
      const units = eligible.flatMap((l) => Array.from({ length: l.qty }, () => l.unitSatang)).sort((a, b) => b - a);
      if (units.length < buy + get) return { ok: false, reason: "ITEM_MISSING" };
      const free = units.slice(-get).reduce((n, p) => n + p, 0);
      return { ok: true, amount: cap(Math.floor((free * (reward.get_percent ?? 100)) / 100), reward.max_discount_satang, subtotal) };
    }
  }
}

const basePrice = (l: PreviewLine) => l.unitSatang - (l.optionDeltas ?? []).reduce((n, o) => n + o.delta, 0);

/// a product a free-item reward covers: its product, or one of its products / categories
export const isFreeItem = (r: ValidatedReward, productId: string, categoryId?: string | null) =>
  productId === r.product?.id || r.product_ids.includes(productId) || (categoryId != null && r.category_ids.includes(categoryId));

// null: the reward doesn't apply to this cart yet
export function rewardPreview(reward: ValidatedReward, lines: PreviewLine[], subtotal: number): number | null {
  const r = rewardPreviewResult(reward, lines, subtotal);
  return r.ok ? r.amount : null;
}

// What the counter must add for a reward to apply (shown under the reward while it waits)
export function rewardNeeds(reward: ValidatedReward, reason: "ITEM_MISSING" | "MIN_SPEND", lines: PreviewLine[] = [], subtotal = 0): string {
  if (reason === "MIN_SPEND") return `${money((reward.min_spend_satang ?? 0) - subtotal)} more to use (min ${money(reward.min_spend_satang ?? 0)})`;
  switch (reward.type) {
    case "FREE_ITEM":
      return reward.product ? `Add ${reward.product.name} to use it` : "Add one of the free items to use it";
    case "FREE_OPTION":
      return "Add a drink that can have the free option";
    case "BUY_X_GET_Y": {
      const need = (reward.buy_qty ?? 1) + (reward.get_qty ?? 1);
      const filtered = reward.product_ids.length + reward.category_ids.length > 0;
      const have = lines
        .filter((l) => !filtered || reward.product_ids.includes(l.productId) || (l.categoryId != null && reward.category_ids.includes(l.categoryId)))
        .reduce((n, l) => n + l.qty, 0);
      return `${Math.min(have, need)} of ${need} eligible items`;
    }
    default:
      return "Add an eligible item to use it";
  }
}

// After a reward is scanned: what the counter can do for staff, when there's only one right answer
export type RewardAction =
  | { kind: "add"; product: MenuProduct }
  | { kind: "pick-product"; products: MenuProduct[] }
  | { kind: "add-option"; lineKey: string; product: MenuProduct; option: MenuOption; group: MenuGroup }
  | { kind: "pick-line"; choices: { lineKey: string; product: MenuProduct; option: MenuOption; group: MenuGroup }[] };

type ActionLine = PreviewLine & { key: string; optionIds: string[] };

export function rewardAction(reward: ValidatedReward, lines: ActionLine[], menu: MenuCategory[]): RewardAction | null {
  const products = menu.flatMap((c) => c.products);
  if (reward.type === "FREE_ITEM") {
    if (lines.some((l) => isFreeItem(reward, l.productId, l.categoryId))) return null;
    const free = products.filter((p) => isFreeItem(reward, p.id, p.categoryId));
    if (free.length === 1) return { kind: "add", product: free[0] };
    return free.length ? { kind: "pick-product", products: free } : null;
  }
  if (reward.type === "FREE_OPTION") {
    const filtered = reward.product_ids.length + reward.category_ids.length > 0;
    // already on a line: nothing to do
    if (lines.some((l) => l.optionIds.some((id) => reward.option_ids.includes(id)))) return null;
    const choices = lines.flatMap((l) => {
      const product = products.find((p) => p.id === l.productId);
      if (!product || (filtered && !reward.product_ids.includes(product.id) && !reward.category_ids.includes(product.categoryId))) return [];
      for (const group of product.groups) {
        const option = group.options.find((o) => reward.option_ids.includes(o.id));
        if (option) return [{ lineKey: l.key, product, option, group }];
      }
      return [];
    });
    if (choices.length === 1) return { kind: "add-option", ...choices[0] };
    return choices.length ? { kind: "pick-line", choices } : null;
  }
  return null;
}

/// one line for the scan sheet: what Add to order will do
export function rewardActionText(reward: ValidatedReward, action: RewardAction | null): string {
  if (action?.kind === "add") return `Adds ${action.product.name} to the order (base price free, extras charged)`;
  if (action?.kind === "pick-product") return "Pick which item is free (base price free, extras charged)";
  if (action?.kind === "add-option") return `Adds ${action.option.name} to ${action.product.name}`;
  if (action?.kind === "pick-line") return `Pick which item gets ${action.choices[0].option.name}`;
  switch (reward.type) {
    case "FREE_OPTION":
      return "Waits on the order until a drink that can have it is added";
    case "BUY_X_GET_Y":
      return "Waits on the order and applies itself once the items are in";
    case "FREE_ITEM":
      return "Already in the order: the item's base price is taken off";
    default:
      return reward.min_spend_satang ? "Applies once the order reaches the minimum spend" : "Applies to this order";
  }
}

export const unitLabel = (c: LoyaltyCurrency | undefined) => (c === "STAMPS" ? "stamps" : "pts");

const label = (no: number) => `IPK-${String(no).padStart(6, "0")}`;

// What the order panel shows: the server's reward on a created order, else the cart's previewed one
export function panelReward(order: Order | null, reward: ValidatedReward | null, preview: number | null, lines: PreviewLine[] = []) {
  if (order?.reward_code) {
    const r = order.reward_code;
    return { name: r.reward_name, member: r.member.display_name ?? "Member", memberLabel: label(r.member.member_no), discount: order.discount_satang };
  }
  if (!order && reward) {
    const subtotal = lines.reduce((n, l) => n + l.unitSatang * l.qty, 0);
    const result = rewardPreviewResult(reward, lines, subtotal);
    return {
      name: reward.reward_name,
      member: reward.member.display_name ?? "Member",
      memberLabel: reward.member.label,
      discount: preview,
      // while it waits: what the order still needs
      needs: result.ok ? undefined : rewardNeeds(reward, result.reason, lines, subtotal),
    };
  }
  return null;
}

// "+14 แต้ม · +1 แสตมป์" (customer-facing, Thai)
export function earnText(points: number, stamps = 0): string {
  return [points > 0 ? `+${points} แต้ม` : "", stamps > 0 ? `+${stamps} แสตมป์` : ""].filter(Boolean).join(" · ") || "+0 แต้ม";
}
