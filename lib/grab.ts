"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { needsAck, orderKeys } from "./orders";
import type { Order } from "./types";

// How often the counter checks for Grab orders nobody has seen. Push is the fast path;
// this is the fallback for a tablet whose notifications are muted or not set up.
const POLL_MS = 15_000;

// GET /order?channel=GRAB — this shift's Grab orders; the ones still waiting for "Got it"
export function useUnseenGrabOrders(enabled: boolean) {
  return useQuery({
    queryKey: [...orderKeys.all, "grab"],
    queryFn: () => api.get<Order[]>("/order", { channel: "GRAB" }),
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    select: (orders) => orders.filter(needsAck),
  });
}

// "Got it": someone saw the Grab order, the server stops re-alerting
export function useAckGrab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.post(`/grab/orders/${orderId}/ack`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
