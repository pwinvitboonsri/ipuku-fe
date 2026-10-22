"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { v7 as uuidv7 } from "uuid";
import { ApiError, api, errorText } from "./api";
import { rewardPreview } from "./loyalty";
import { orderKeys, type DisplayLine } from "./orders";
import type { MenuOption, MenuProduct, Order, StockAlert, ValidatedReward } from "./types";

// The cart lives on the device until Charge. Prices here are a preview; the server re-prices at create.

// categoryId and optionDeltas let the reward preview apply category / free-option rules
export type CartLine = DisplayLine & { optionIds: string[]; categoryId?: string | null; optionDeltas?: { id: string; delta: number }[] };
export type Step = "sell" | "payment" | "success";
export type CreateState = "creating" | "retry" | "error" | null;

// reward: a LINE reward code validated at the counter; its discount is set by the server at charge
type Persisted = { lines: CartLine[]; pendingId: string | null; reward?: ValidatedReward | null };
const STORAGE_KEY = "ipk-cart";

function load(): Persisted {
  if (typeof window === "undefined") return { lines: [], pendingId: null, reward: null };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable — start empty */
  }
  return { lines: [], pendingId: null, reward: null };
}

const sameOptions = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function linesFromOrder(o: Order): CartLine[] {
  return o.order_item.map((i) => ({
    key: i.id,
    productId: i.product_id,
    name: i.product_name_snapshot,
    mods: i.order_item_modifier.map((m) => m.name_snapshot),
    optionIds: i.order_item_modifier.map((m) => m.modifier_option_id),
    optionDeltas: i.order_item_modifier.map((m) => ({ id: m.modifier_option_id, delta: m.price_delta_satang })),
    qty: i.quantity,
    unitSatang: i.unit_price_satang,
    totalSatang: i.line_total_satang,
  }));
}

type CartCtx = {
  lines: CartLine[];
  previewTotal: number; // after the reward discount
  reward: ValidatedReward | null;
  rewardDiscount: number | null; // preview; null = the reward's free item isn't in the cart
  step: Step;
  order: Order | null; // the server order during payment / success
  stockAlerts: StockAlert[]; // ingredients the last payment took to/below reorder level (success screen)
  createState: CreateState;
  createError: string | null;
  // the reward is on another open order (e.g. one created before a timeout): its number, to offer voiding it
  heldBy: { id: string; number: number } | null;
  pendingId: string | null;
  add: (p: MenuProduct, options: MenuOption[], qty: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setReward: (r: ValidatedReward | null) => void;
  charge: () => void;
  retryCreate: () => void;
  freeRewardAndRetry: () => void;
  backToCart: () => void;
  takePaymentFor: (o: Order) => void;
  paid: (o: Order, stockAlerts?: StockAlert[]) => void;
  voided: (o: Order) => void;
  nextOrder: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [initial] = useState(load);
  const [lines, setLines] = useState<CartLine[]>(initial.lines);
  // client_order_id for the current cart. Reused on retry; dropped whenever the cart changes.
  const [pendingId, setPendingId] = useState<string | null>(initial.pendingId);
  const [reward, setRewardState] = useState<ValidatedReward | null>(initial.reward ?? null);
  const [step, setStep] = useState<Step>("sell");
  const [order, setOrder] = useState<Order | null>(null);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [createState, setCreateState] = useState<CreateState>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [heldBy, setHeldBy] = useState<{ id: string; number: number } | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, pendingId, reward } satisfies Persisted));
    } catch {
      /* ignore */
    }
  }, [lines, pendingId, reward]);

  const edit = useCallback((fn: (ls: CartLine[]) => CartLine[]) => {
    setLines(fn);
    setPendingId(null);
  }, []);

  const create = useMutation({
    mutationFn: (vars: { id: string; lines: CartLine[]; rewardCode: string | null }) =>
      api.post<Order>("/order/create", {
        client_order_id: vars.id,
        items: vars.lines.map((l) => ({ product_id: l.productId, quantity: l.qty, modifier_option_ids: l.optionIds })),
        ...(vars.rewardCode && { reward_code: vars.rewardCode }),
      }),
    onSuccess: (o) => {
      setOrder(o);
      setCreateState(null);
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (err) => {
      // Unreachable/timeout: the order may or may not exist — retrying with the same id is safe.
      const unreachable = err instanceof ApiError && [0, 502, 503, 504].includes(err.status);
      setCreateState(unreachable ? "retry" : "error");
      setCreateError(errorText(err));
      const b = err instanceof ApiError ? err.body : {};
      setHeldBy(err instanceof ApiError && err.code === "APPLIED" && typeof b.order_id === "string" ? { id: b.order_id, number: Number(b.order_number) } : null);
    },
  });

  const value = useMemo<CartCtx>(() => {
    const startCreate = (id: string) => {
      setCreateState("creating");
      setCreateError(null);
      setHeldBy(null);
      create.mutate({ id, lines, rewardCode: reward?.code ?? null });
    };
    const subtotal = lines.reduce((s, l) => s + l.totalSatang, 0);
    const discount = reward ? rewardPreview(reward, lines, subtotal) : null;
    return {
      lines,
      previewTotal: subtotal - (discount ?? 0),
      reward,
      rewardDiscount: discount,
      step,
      order,
      stockAlerts,
      createState,
      createError,
      heldBy,
      pendingId,
      add: (p, options, qty) => {
        const optionIds = options.map((o) => o.id);
        const unit = p.price_satang + options.reduce((s, o) => s + o.price_delta_satang, 0);
        edit((ls) => {
          const same = ls.find((l) => l.productId === p.id && sameOptions(l.optionIds, optionIds));
          if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + qty, totalSatang: l.unitSatang * (l.qty + qty) } : l));
          return [
            ...ls,
            {
              key: uuidv7(),
              productId: p.id,
              categoryId: p.categoryId,
              name: p.name,
              imageUrl: p.image_url,
              mods: options.map((o) => o.name),
              optionIds,
              optionDeltas: options.map((o) => ({ id: o.id, delta: o.price_delta_satang })),
              qty,
              unitSatang: unit,
              totalSatang: unit * qty,
            },
          ];
        });
      },
      setQty: (key, qty) => edit((ls) => ls.map((l) => (l.key === key ? { ...l, qty, totalSatang: l.unitSatang * qty } : l))),
      remove: (key) => edit((ls) => ls.filter((l) => l.key !== key)),
      clear: () => {
        edit(() => []);
        setRewardState(null);
      },
      setReward: (r) => {
        setRewardState(r);
        setPendingId(null);
      },
      charge: () => {
        if (!lines.length) return;
        const id = pendingId ?? uuidv7();
        setPendingId(id);
        setOrder(null);
        setStep("payment");
        startCreate(id);
      },
      retryCreate: () => pendingId && startCreate(pendingId),
      freeRewardAndRetry: () => {
        if (!heldBy || !pendingId) return;
        setCreateState("creating");
        // voiding the open order puts the reward back on the customer's code; then create this one
        api
          .post(`/order/${heldBy.id}/void`, { reason: `Reward moved to a new order` })
          .then(() => {
            qc.invalidateQueries({ queryKey: orderKeys.all });
            startCreate(pendingId);
          })
          .catch((err) => {
            setCreateState("error");
            setCreateError(errorText(err));
          });
      },
      backToCart: () => {
        // Keep pendingId: if the cart is charged again unchanged, the server returns the same order.
        setCreateState(null);
        setOrder(null);
        setStep("sell");
      },
      takePaymentFor: (o) => {
        setOrder(o);
        setCreateState(null);
        setStep("payment");
      },
      paid: (o, alerts = []) => {
        setOrder(o);
        setStockAlerts(alerts);
        setStep("success");
        // Only clear the cart if this order was created from it (not one picked up from Orders).
        if (o.client_order_id === pendingId) {
          setLines([]);
          setPendingId(null);
          setRewardState(null);
        }
        qc.invalidateQueries({ queryKey: orderKeys.all });
        // a stock status changed, so the grid's Low / Out tags must refresh
        if (alerts.length) qc.invalidateQueries({ queryKey: ["menu"] });
      },
      voided: (o) => {
        // Void & edit: the order's lines come back to the cart; the next Charge gets a new client_order_id.
        // An order picked up from Orders is added to whatever is already in the cart.
        const fromThisCart = o.client_order_id === pendingId;
        setLines((ls) => (fromThisCart || !ls.length ? linesFromOrder(o) : [...ls, ...linesFromOrder(o)]));
        setPendingId(null);
        setOrder(null);
        setStep("sell");
        qc.invalidateQueries({ queryKey: orderKeys.all });
      },
      nextOrder: () => {
        setOrder(null);
        setStep("sell");
      },
    };
  }, [lines, reward, step, order, stockAlerts, createState, createError, heldBy, pendingId, create, edit, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
