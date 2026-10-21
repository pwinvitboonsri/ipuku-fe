import { clock, money } from "@/lib/format";
import type { Order } from "@/lib/types";

const who = (m: { display_name: string | null } | null | undefined) => m?.display_name ?? "A member";
const GREEN = { background: "#E5F8EC", color: "#0A7A3B" };

// Order detail: who collected the points, and the reward that discounted it (loyalty design, Flow 4 step 1)
export function OrderLoyalty({ o }: { o: Order }) {
  const claim = o.claim_token;
  const reward = o.reward_code;
  if (!claim && !reward) return null;
  return (
    <div className="flex flex-col gap-2">
      {reward && (
        <div className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-[13px]" style={GREEN}>
          <span>
            <b>{who(reward.member)}</b> used <b>{reward.reward_name}</b> · {reward.cost_points} pts
            {reward.status !== "USED" && <span className="opacity-75"> · {reward.status.toLowerCase()}</span>}
          </span>
          {o.discount_satang > 0 && <b className="mono shrink-0">−{money(o.discount_satang)}</b>}
        </div>
      )}
      {claim?.claimed_at ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-[13px]" style={GREEN}>
          <span>
            <b>{who(claim.member)}</b> claimed points at {clock(claim.claimed_at)}
          </span>
          <b className="mono shrink-0">+{claim.points} pts</b>
        </div>
      ) : (
        claim &&
        o.status === "PAID" && (
          <div className="rounded-[10px] bg-paper-2 px-3 py-2.5 text-[12.5px] text-ink-2">
            Points QR not collected yet · {claim.points} pts · code <b className="mono">{claim.display_code}</b> · until {clock(claim.expires_at)}
          </div>
        )
      )}
    </div>
  );
}

// What voiding/refunding does to points, shown in the confirm sheet (design: "will be reversed (−14)")
export function loyaltyNotice(o: Order, kind: "void" | "refund"): string | null {
  const reward = o.reward_code;
  const claim = o.claim_token;
  if (kind === "void") {
    return reward?.status === "APPLIED" ? `The reward (${reward.reward_name}) goes back to ${who(reward.member)}'s LINE for a few minutes.` : null;
  }
  const parts: string[] = [];
  if (claim?.claimed_at) parts.push(`Points earned from this order will be reversed (−${claim.points}) · ${who(claim.member)} gets a LINE message.`);
  else if (claim) parts.push("The points QR for this order will stop working.");
  if (reward?.status === "USED") parts.push(`${who(reward.member)} gets back the ${reward.cost_points} pts spent on ${reward.reward_name}.`);
  return parts.length ? parts.join(" ") : null;
}
