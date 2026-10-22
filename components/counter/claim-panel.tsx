"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ClaimTokenInfo, Order } from "@/lib/types";
import { earnText } from "@/lib/loyalty";
import { Qr } from "@/components/ui/qr";

const thaiExpiry = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

// While the QR is up, watch the order so the screen shows when the customer has collected
export function useClaimWatch(order: Order) {
  const claim = order.claim_token;
  const live = useQuery({
    queryKey: ["order", order.id, "claim"],
    queryFn: async () => (await api.get<Order>(`/order/${order.id}`)).claim_token ?? null,
    enabled: !!claim?.url && !claim.claimed_at,
    refetchInterval: (q) => (q.state.data?.claimed_at ? false : 3000),
  });
  return live.data ?? claim ?? null;
}

// Customer-facing "scan to collect points" (loyalty design, Flow 2 step 3). Thai first: it faces the customer.
// Same one-time token as the QR printed on the receipt.
export function ClaimPanel({ claim }: { claim: ClaimTokenInfo }) {
  const claimed = !!claim.claimed_at;
  return (
    <div className="rise-3 flex w-full shrink-0 flex-col items-center justify-center gap-2.5 rounded-[18px] bg-ink px-5 py-6 text-center text-paper md:w-[300px] md:rounded-none md:py-5">
      <span className="mono text-[9.5px] tracking-[1.5px] opacity-60">FOR THE CUSTOMER</span>
      {claimed ? (
        <>
          <div className="pop flex h-[64px] w-[64px] items-center justify-center rounded-full bg-matcha text-[30px] font-bold">✓</div>
          <div className="text-[17px] font-bold">สะสมแต้มแล้ว</div>
          <div className="mono text-[22px] font-semibold text-yuzu">{earnText(claim.points, claim.stamps)}</div>
          {claim.member && <div className="text-[12.5px] opacity-75">{claim.member.display_name ?? "Member"} · collected in LINE</div>}
        </>
      ) : (
        <>
          <div className="text-[17px] font-bold">สแกนเพื่อสะสมแต้ม</div>
          <div className="text-[12px] opacity-70">Scan with LINE to collect points</div>
          <div className="rounded-[12px] bg-white p-2">
            <Qr value={claim.url!} size={168} />
          </div>
          <div className="mono text-[22px] font-semibold text-yuzu">{earnText(claim.points, claim.stamps)}</div>
          <div className="text-[11px] leading-[1.5] opacity-70">
            รหัส <b className="mono">{claim.display_code}</b> · ใช้ได้ถึง {thaiExpiry(claim.expires_at)} · ครั้งเดียว
          </div>
        </>
      )}
    </div>
  );
}
