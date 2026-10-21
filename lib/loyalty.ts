import type { DisplayLine } from "./orders";
import type { Order, ValidatedReward } from "./types";

// Preview of the discount a reward gives this cart — the same rule as the API (reward-discount.function.ts),
// which decides the real amount at order create. null: a free item that isn't in the cart.
export function rewardPreview(reward: ValidatedReward, lines: Pick<DisplayLine, "productId" | "unitSatang">[], subtotal: number): number | null {
  if (reward.type === "FIXED_DISCOUNT") return Math.min(reward.discount_satang ?? 0, subtotal);
  const prices = lines.filter((l) => l.productId === reward.product?.id).map((l) => l.unitSatang);
  if (!prices.length) return null;
  const unit = Math.max(...prices);
  return Math.min(unit, reward.max_discount_satang ?? unit, subtotal);
}

const label = (no: number) => `IPK-${String(no).padStart(6, "0")}`;

// What the order panel shows: the server's reward on a created order, else the cart's previewed one
export function panelReward(order: Order | null, reward: ValidatedReward | null, preview: number | null) {
  if (order?.reward_code) {
    const r = order.reward_code;
    return { name: r.reward_name, member: r.member.display_name ?? "Member", memberLabel: label(r.member.member_no), discount: order.discount_satang };
  }
  if (!order && reward) {
    return { name: reward.reward_name, member: reward.member.display_name ?? "Member", memberLabel: reward.member.label, discount: preview, product: reward.product?.name };
  }
  return null;
}
