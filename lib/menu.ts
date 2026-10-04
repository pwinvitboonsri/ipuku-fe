"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { MenuCategory, MenuCategoryRaw } from "./types";

// GET /menu — the whole sell screen in one call: active categories → products → groups → options,
// already in display order, with each product's stock status. Cached and refreshed on focus,
// and after a sale that changed a stock status (see cart.paid).
export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: () => api.get<MenuCategoryRaw[]>("/menu"),
    select: (raw): MenuCategory[] =>
      raw.map((c) => ({
        id: c.id,
        name: c.name,
        products: c.product.map((p) => ({
          id: p.id,
          name: p.name,
          price_satang: p.price_satang,
          image_url: p.image_url,
          categoryId: c.id,
          stock: p.stock ?? { status: "OK", ingredients: [] },
          groups: p.modifier_group.map(({ modifier_group: g }) => ({
            id: g.id,
            name: g.name,
            min: g.min_select,
            max: g.max_select,
            options: g.modifier_option,
          })),
        })),
      })),
    staleTime: 5 * 60_000,
  });
}
