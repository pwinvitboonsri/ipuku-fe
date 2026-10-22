import { money } from "./format";
import type { DisplayLine } from "./orders";
import type { LoyaltyCurrency, Order, ValidatedReward } from "./types";

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
      const prices = lines.filter((l) => l.productId === reward.product?.id).map((l) => l.unitSatang);
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

// null: the reward doesn't apply to this cart yet
export function rewardPreview(reward: ValidatedReward, lines: PreviewLine[], subtotal: number): number | null {
  const r = rewardPreviewResult(reward, lines, subtotal);
  return r.ok ? r.amount : null;
}

// What the counter must add for a reward to apply (shown under the reward)
export function rewardNeeds(reward: ValidatedReward, reason: "ITEM_MISSING" | "MIN_SPEND"): string {
  if (reason === "MIN_SPEND") return `Needs an order of at least ${money(reward.min_spend_satang ?? 0)}`;
  switch (reward.type) {
    case "FREE_ITEM":
      return `Add ${reward.product?.name ?? "the item"} to the order first`;
    case "FREE_OPTION":
      return "Add an item with the free option (e.g. the size-up) first";
    case "BUY_X_GET_Y":
      return `Needs ${(reward.buy_qty ?? 1) + (reward.get_qty ?? 1)} eligible items in the order`;
    default:
      return "Add an eligible item to the order first";
  }
}

export const unitLabel = (c: LoyaltyCurrency | undefined) => (c === "STAMPS" ? "stamps" : "pts");

const label = (no: number) => `IPK-${String(no).padStart(6, "0")}`;

// What the order panel shows: the server's reward on a created order, else the cart's previewed one
export function panelReward(order: Order | null, reward: ValidatedReward | null, preview: number | null) {
  if (order?.reward_code) {
    const r = order.reward_code;
    return { name: r.reward_name, member: r.member.display_name ?? "Member", memberLabel: label(r.member.member_no), discount: order.discount_satang };
  }
  if (!order && reward) {
    return {
      name: reward.reward_name,
      member: reward.member.display_name ?? "Member",
      memberLabel: reward.member.label,
      discount: preview,
      needs: preview === null ? rewardNeeds(reward, "ITEM_MISSING") : undefined,
    };
  }
  return null;
}

// "+14 แต้ม · +1 แสตมป์" (customer-facing, Thai)
export function earnText(points: number, stamps = 0): string {
  return [points > 0 ? `+${points} แต้ม` : "", stamps > 0 ? `+${stamps} แสตมป์` : ""].filter(Boolean).join(" · ") || "+0 แต้ม";
}
