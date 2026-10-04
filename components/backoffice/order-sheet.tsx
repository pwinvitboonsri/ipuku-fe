"use client";

import { useQuery } from "@tanstack/react-query";
import { api, errorText } from "@/lib/api";
import { clock, money, shortDate } from "@/lib/format";
import { paymentLabel } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { Pill, Spinner } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/sheet";

// Read-only order, opened by id (stock movements only carry order_id). GET /order/:id
export function OrderSheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["order", "by-id", orderId], queryFn: () => api.get<Order>(`/order/${orderId}`) });
  const o = q.data;
  const paidBy = o ? paymentLabel(o) : "";
  return (
    <Sheet
      title={o ? `Order #${o.order_number}` : "Order"}
      sub={o ? `${shortDate(o.create_at)} · ${clock(o.create_at)}${paidBy ? ` · ${paidBy}` : ""}` : undefined}
      onClose={onClose}
    >
      {q.isPending && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {q.isError && <div className="text-[13px] text-persimmon-2">{errorText(q.error)}</div>}
      {o && (
        <div>
          <div className="mb-2">
            <Pill tone={o.status}>{o.status}</Pill>
          </div>
          {o.order_item.map((l) => (
            <div key={l.id} className="flex justify-between gap-3 border-b border-line py-2.5">
              <div>
                <div className="text-[14px] font-medium">
                  {l.quantity} × {l.product_name_snapshot}
                </div>
                {l.order_item_modifier.length > 0 && <div className="mt-0.5 text-[12.5px] text-muted">{l.order_item_modifier.map((m) => m.name_snapshot).join(" · ")}</div>}
              </div>
              <span className="mono text-[14px]">{money(l.line_total_satang)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2.5 text-[16px] font-semibold">
            <span>Total</span>
            <span className="mono">{money(o.total_satang)}</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}
