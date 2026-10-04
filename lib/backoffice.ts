"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "./api";
import type { CashSession, Category, Ingredient, ModifierGroupRow, Product, ProductGroupLink, RecipeLine, RecipeModifierLine, StaffRow, StockMovement, StockReason } from "./types";

// Owner back office data. Lists ask for inactive rows too (?include_inactive=true) so they can be switched back on.
export const bo = {
  categories: ["bo", "categories"] as const,
  products: ["bo", "products"] as const,
  groups: ["bo", "groups"] as const,
  ingredients: ["bo", "ingredients"] as const,
  productGroups: (id: string) => ["bo", "product-groups", id] as const,
  recipe: (id: string) => ["bo", "recipe", id] as const,
  movements: (f: object) => ["bo", "movements", f] as const,
  shifts: (f: object) => ["bo", "shifts", f] as const,
  staff: ["bo", "staff"] as const,
};

const ALL = { include_inactive: true };
const bySort = <T extends { sort_order: number; name: string }>(a: T, b: T) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

export const useCategories = () =>
  useQuery({ queryKey: bo.categories, queryFn: () => api.get<Category[]>("/category", ALL), select: (l) => [...l].sort(bySort) });
export const useProducts = () =>
  useQuery({ queryKey: bo.products, queryFn: () => api.get<Product[]>("/product/list", ALL), select: (l) => [...l].sort((a, b) => a.name.localeCompare(b.name)) });
export const useGroups = () =>
  useQuery({
    queryKey: bo.groups,
    queryFn: () => api.get<ModifierGroupRow[]>("/modifier-group", ALL),
    select: (l) => l.map((g) => ({ ...g, modifier_option: [...g.modifier_option].sort(bySort) })),
  });
export const useIngredients = () =>
  useQuery({ queryKey: bo.ingredients, queryFn: () => api.get<Ingredient[]>("/ingredient", ALL), select: (l) => [...l].sort((a, b) => a.name.localeCompare(b.name)) });
export const useProductGroups = (productId: string) =>
  useQuery({ queryKey: bo.productGroups(productId), queryFn: () => api.get<ProductGroupLink[]>(`/product-modifier-group/product/${productId}`) });
// GET /recipe/product/:id → { data: base lines, modifiers: product × option lines }
export const useRecipe = (productId: string) =>
  useQuery({
    queryKey: bo.recipe(productId),
    queryFn: async () => {
      const r = await api.list<RecipeLine[]>(`/recipe/product/${productId}`);
      return { base: r.data, modifiers: (r.raw as { modifiers?: RecipeModifierLine[] }).modifiers ?? [] };
    },
  });

export type MovementFilter = { ingredient_id?: string; reason?: StockReason; after?: string; before?: string };
export const useMovements = (f: MovementFilter) => useQuery({ queryKey: bo.movements(f), queryFn: () => api.get<StockMovement[]>("/stock-movement", f) });

export const useShifts = (f: { before: string; after?: string }) =>
  useQuery({ queryKey: bo.shifts(f), queryFn: () => api.get<CashSession[]>("/cash-session", f) });

export const useStaffAdmin = () =>
  useQuery({ queryKey: bo.staff, queryFn: async () => (await api.get<{ staff: StaffRow[]; total: number }>("/auth/staff")).staff });

// A mutation that refreshes the given caches afterwards. Menu edits also refresh the counter's /menu.
export function useBoMutation<V, R = unknown>(fn: (v: V) => Promise<R>, invalidate: QueryKey[], opts?: { onSuccess?: (r: R, v: V) => void }) {
  const qc = useQueryClient();
  const refresh = useCallback(() => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k }))), [qc, invalidate]);
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, v) => {
      await refresh();
      opts?.onSuccess?.(r, v);
    },
  });
}

export const MENU_KEY = ["menu"] as const;
export const STAFF_LIST_KEY = ["staff-list"] as const;

// Satang ⇄ baht text for price inputs ("85.5" → 8550). Invalid → null.
export function parseBaht(s: string): number | null {
  if (!/^-?\d*(\.\d{0,2})?$/.test(s.trim()) || s.trim() === "" || s.trim() === "-") return null;
  return Math.round(Number(s) * 100);
}
export const bahtText = (satang: number) => (satang / 100).toFixed(2).replace(/\.00$/, "");

// Hundredths ⇄ unit text for quantity inputs ("25.5" → 2550)
export function parseQty(s: string): number | null {
  if (!/^\d*(\.\d{0,2})?$/.test(s.trim()) || s.trim() === "") return null;
  return Math.round(Number(s) * 100);
}
export const qtyText = (h: number) => String(h / 100);

// Signed variant for option recipe deltas ("-180" → -18000). Zero and invalid → null.
export function parseSignedQty(s: string): number | null {
  const t = s.trim();
  if (!/^-?\d*(\.\d{0,2})?$/.test(t) || t === "" || t === "-") return null;
  const v = Math.round(Number(t) * 100);
  return v === 0 ? null : v;
}
