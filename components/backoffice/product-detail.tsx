"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { MENU_KEY, bahtText, bo, parseBaht, parseQty, parseSignedQty, qtyText, useBoMutation, useGroups, useIngredients, useProductGroups, useRecipe } from "@/lib/backoffice";
import { money, qty } from "@/lib/format";
import type { Category, Ingredient, Product, RecipeLine, RecipeModifierLine } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, Pill, Toggle } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { ItemPhoto } from "@/components/counter/item-photo";
import { PhotoField } from "./photo-field";
import { Loadable, Move, Select, swap } from "./common";

type Tab = "details" | "options" | "recipe";

export function ProductDetail({ p, categories, onClose }: { p: Product; categories: Category[]; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("details");
  const catName = categories.find((c) => c.id === p.category_id)?.name ?? "—";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 shrink-0">
          <ItemPhoto id={p.id} name={p.name} imageUrl={p.image_url} size="hero" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-semibold">{p.name}</div>
          <div className="text-[12.5px] text-muted">
            {catName} · {p.is_active ? "Active" : "Inactive — hidden from counter"}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="tap h-8 w-8 shrink-0 rounded-full bg-paper-2 text-[16px]">
          ×
        </button>
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "details", label: "Details" },
          { value: "options", label: "Options" },
          { value: "recipe", label: "Recipe" },
        ]}
      />
      <div key={tab} className="fade-swap">
        {tab === "details" && <ProductDetails p={p} categories={categories} />}
        {tab === "options" && <ProductOptions p={p} />}
        {tab === "recipe" && <ProductRecipe p={p} />}
      </div>
    </div>
  );
}

function ProductDetails({ p, categories }: { p: Product; categories: Category[] }) {
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(bahtText(p.price_satang));
  const [cat, setCat] = useState(p.category_id);
  const [image, setImage] = useState<string | null>(p.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const satang = parseBaht(price);

  const changes: Record<string, unknown> = {};
  if (name.trim() !== p.name) changes.name = name.trim();
  if (satang !== null && satang !== p.price_satang) changes.price_satang = satang;
  if (cat !== p.category_id) changes.category_id = cat;
  // null removes the photo (and the backend deletes the old file)
  if (image !== (p.image_url ?? null)) changes.image_url = image;
  const dirty = Object.keys(changes).length > 0;
  const valid = name.trim() !== "" && satang !== null && satang >= 0;

  const save = useBoMutation(() => api.post(`/product/${p.id}/update`, changes), [bo.products, MENU_KEY]);
  const toggle = useBoMutation(() => api.post(`/product/${p.id}/update-status`), [bo.products, MENU_KEY]);
  const reset = () => {
    setName(p.name);
    setPrice(bahtText(p.price_satang));
    setCat(p.category_id);
    setImage(p.image_url ?? null);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Name">
        <TextInput value={name} onChange={setName} />
      </Field>
      <Field
        label="Price"
        error={price && satang === null ? "Enter an amount like 85 or 85.50" : null}
        hint={satang !== null && satang !== p.price_satang ? `Was ${money(p.price_satang)}. Past orders keep their original price.` : "VAT included · stored in satang"}
      >
        <TextInput value={price} onChange={(v) => setPrice(v.replace(/[^\d.]/g, ""))} prefix="฿" mono inputMode="decimal" />
      </Field>
      <Field label="Category">
        <Select value={cat} onChange={setCat}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? "" : " (inactive)"}
            </option>
          ))}
        </Select>
      </Field>
      <PhotoField id={p.id} name={name} value={image} onChange={setImage} onBusy={setUploading} />
      <Card pad={14} className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[14px] font-semibold">Active</div>
          <div className="text-[12.5px] text-muted">Turn off when sold out or seasonal. Nothing is deleted.</div>
        </div>
        <Toggle on={p.is_active} disabled={toggle.isPending} onChange={() => toggle.mutate(undefined)} />
      </Card>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex-1 text-[12px] text-muted">{save.isSuccess && !dirty ? "Saved" : dirty ? "Unsaved changes" : "No changes"}</span>
        <Btn kind="secondary" disabled={!dirty || uploading} onClick={reset}>
          Reset
        </Btn>
        <Btn kind="primary" disabled={!dirty || !valid || uploading || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending ? "Saving…" : "Save"}
        </Btn>
      </div>
      {(save.isError || toggle.isError) && <ErrorNote>{errorText(save.error ?? toggle.error)}</ErrorNote>}
    </div>
  );
}

function ProductOptions({ p }: { p: Product }) {
  const links = useProductGroups(p.id);
  const groups = useGroups();
  const [pick, setPick] = useState("");
  const keys = [bo.productGroups(p.id), MENU_KEY];
  const attach = useBoMutation(
    (v: { groupId: string; sort: number }) => api.post("/product-modifier-group/attach", { product_id: p.id, modifier_group_id: v.groupId, sort_order: v.sort }),
    keys,
    { onSuccess: () => setPick("") },
  );
  const detach = useBoMutation((groupId: string) => api.post("/product-modifier-group/detach", { product_id: p.id, modifier_group_id: groupId }), keys);
  // Reorder: rewrite sort_order = position for every link that moved
  const reorder = useBoMutation(async (order: { id: string; sort: number }[]) => {
    for (const [i, l] of order.entries()) {
      if (l.sort !== i) await api.post("/product-modifier-group/update", { product_id: p.id, modifier_group_id: l.id, sort_order: i });
    }
  }, keys);

  return (
    <Loadable queries={[links, groups]}>
      {() => {
        const attached = links.data!;
        const activeCount = (id: string) => groups.data!.find((g) => g.id === id)?.modifier_option.filter((o) => o.is_active).length ?? 0;
        const available = groups.data!.filter((g) => !attached.some((l) => l.modifier_group_id === g.id));
        const pickG = groups.data!.find((g) => g.id === pick);
        const blocked = !!pickG && activeCount(pickG.id) < pickG.min_select;
        const order = attached.map((l) => ({ id: l.modifier_group_id, sort: l.sort_order }));
        const err = attach.error ?? detach.error ?? reorder.error;
        return (
          <div className="flex flex-col gap-3">
            <div className="text-[12.5px] text-muted">Shown on the counter&apos;s options sheet in this order. Inactive groups are hidden here and on the counter.</div>
            <Card>
              {attached.length === 0 && <div className="p-[18px] text-center text-[13px] text-muted">No option groups — tapping this product adds it straight to the cart.</div>}
              {attached.map((l, i) => {
                const g = l.modifier_group;
                return (
                  <div key={l.modifier_group_id} className={`flex items-center gap-2.5 px-3 py-2.5 ${i ? "border-t border-line" : ""}`}>
                    <Move
                      first={i === 0}
                      last={i === attached.length - 1}
                      onUp={() => reorder.mutate(swap(order, i, i - 1))}
                      onDown={() => reorder.mutate(swap(order, i, i + 1))}
                    />
                    <span className="mono w-3.5 text-[11px] text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{g.name}</div>
                      <div className="text-[12px] text-muted">
                        {g.min_select >= 1 ? "Required" : "Optional"} · pick {g.min_select === g.max_select ? g.max_select : `${g.min_select}–${g.max_select}`} · {g.modifier_option.length} options
                      </div>
                    </div>
                    <Btn kind="ghost" size="sm" disabled={detach.isPending} onClick={() => detach.mutate(l.modifier_group_id)}>
                      Detach
                    </Btn>
                  </div>
                );
              })}
            </Card>
            <div className="flex gap-2">
              <Select value={pick} onChange={setPick} className="min-w-0 flex-1">
                <option value="">Attach a group…</option>
                {available.map((g) => (
                  <option key={g.id} value={g.id} disabled={!g.is_active}>
                    {g.name} ({activeCount(g.id)} active){g.is_active ? "" : " — inactive"}
                  </option>
                ))}
              </Select>
              <Btn
                kind="primary"
                disabled={!pick || blocked || attach.isPending}
                onClick={() => attach.mutate({ groupId: pick, sort: attached.length ? Math.max(...attached.map((l) => l.sort_order)) + 1 : 0 })}
              >
                Attach
              </Btn>
            </div>
            {blocked && (
              <div className="text-[12.5px] text-persimmon-2">
                &quot;{pickG!.name}&quot; needs at least {pickG!.min_select} active option{pickG!.min_select === 1 ? "" : "s"} but has {activeCount(pickG!.id)}. Turn options on in Option groups first.
              </div>
            )}
            {err && <ErrorNote>{errorText(err)}</ErrorNote>}
          </div>
        );
      }}
    </Loadable>
  );
}

function stockTone(i?: Ingredient) {
  if (!i) return null;
  return i.stock_quantity < 0 ? "NEG" : i.stock_quantity <= i.reorder_level ? "LOW" : null;
}

function RecipeRow({ line, ing, first, productId }: { line: RecipeLine; ing?: Ingredient; first: boolean; productId: string }) {
  const [text, setText] = useState(qtyText(line.quantity_per_unit));
  const keys = [bo.recipe(productId), MENU_KEY];
  const update = useBoMutation((q: number) => api.post(`/recipe/${line.id}/update`, { quantity_per_unit: q }), keys);
  const remove = useBoMutation(() => api.post(`/recipe/${line.id}/delete`), keys);
  const parsed = parseQty(text);
  const commit = () => {
    if (parsed === null || parsed < 1) return setText(qtyText(line.quantity_per_unit));
    if (parsed !== line.quantity_per_unit) update.mutate(parsed);
  };
  const t = stockTone(ing);
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 ${first ? "" : "border-t border-line"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
          {line.ingredient.name}
          {t && <Pill tone={t}>{t === "NEG" ? "Negative" : "Low"}</Pill>}
        </div>
        <div className="text-[12px] text-muted">{ing ? `In stock ${qty(ing.stock_quantity, ing.unit)}` : "Ingredient inactive"}</div>
        {(update.isError || remove.isError) && <ErrorNote>{errorText(update.error ?? remove.error)}</ErrorNote>}
      </div>
      <div className="w-[110px] shrink-0">
        <TextInput
          value={text}
          onChange={(v) => setText(v.replace(/[^\d.]/g, ""))}
          suffix={line.ingredient.unit}
          mono
          inputMode="decimal"
          style={{ padding: "8px 40px 8px 10px", fontSize: 13.5 }}
        />
      </div>
      {/* Each line saves on its own; recipe edits never touch current stock */}
      <button type="button" aria-label="Save quantity" onClick={commit} disabled={parsed === line.quantity_per_unit || update.isPending} className="tap shrink-0 rounded-[8px] px-2 py-1.5 text-[12px] font-semibold" style={{ color: parsed !== line.quantity_per_unit ? "var(--matcha)" : "var(--muted-2)" }}>
        {update.isPending ? "…" : "Save"}
      </button>
      <button type="button" aria-label="Remove from recipe" onClick={() => remove.mutate(undefined)} disabled={remove.isPending} className="tap h-[30px] w-[30px] shrink-0 rounded-[8px] text-[16px] text-persimmon-2">
        ×
      </button>
    </div>
  );
}

// One product × option line: signed delta on top of the base recipe
function ModifierRow({ line, ing, first, productId }: { line: RecipeModifierLine; ing?: Ingredient; first: boolean; productId: string }) {
  const [text, setText] = useState(qtyText(line.quantity_delta));
  const keys = [bo.recipe(productId), MENU_KEY];
  const update = useBoMutation((q: number) => api.post(`/recipe/modifier/${line.id}/update`, { quantity_delta: q }), keys);
  const remove = useBoMutation(() => api.post(`/recipe/modifier/${line.id}/delete`), keys);
  const parsed = parseSignedQty(text);
  const changed = parsed !== null && parsed !== line.quantity_delta;
  return (
    <div className={`flex items-center gap-2.5 py-2 pl-3 pr-2 ${first ? "" : "border-t border-line"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{line.ingredient.name}</div>
        <div className="text-[11.5px] text-muted">{ing ? `In stock ${qty(ing.stock_quantity, ing.unit)}` : "Ingredient inactive"}</div>
        {(update.isError || remove.isError) && <ErrorNote>{errorText(update.error ?? remove.error)}</ErrorNote>}
      </div>
      <div className="w-[110px] shrink-0">
        <TextInput
          value={text}
          onChange={(v) => setText(v.replace(/[^\d.-]/g, ""))}
          suffix={line.ingredient.unit}
          mono
          style={{ padding: "7px 40px 7px 10px", fontSize: 13, color: line.quantity_delta < 0 ? "var(--persimmon-2)" : undefined }}
        />
      </div>
      <button
        type="button"
        aria-label="Save change"
        onClick={() => changed && update.mutate(parsed!)}
        disabled={!changed || update.isPending}
        className="tap shrink-0 rounded-[8px] px-2 py-1.5 text-[12px] font-semibold"
        style={{ color: changed ? "var(--matcha)" : "var(--muted-2)" }}
      >
        {update.isPending ? "…" : "Save"}
      </button>
      <button type="button" aria-label="Remove line" onClick={() => remove.mutate(undefined)} disabled={remove.isPending} className="tap h-[30px] w-[30px] shrink-0 rounded-[8px] text-[16px] text-persimmon-2">
        ×
      </button>
    </div>
  );
}

function OptionAdjustments({
  productId,
  optionId,
  lines,
  ingredients,
}: {
  productId: string;
  optionId: string;
  lines: RecipeModifierLine[];
  ingredients: Ingredient[];
}) {
  const [ing, setIng] = useState("");
  const [q, setQ] = useState("");
  const parsed = parseSignedQty(q);
  const create = useBoMutation(
    () => api.post("/recipe/modifier/create", { product_id: productId, modifier_option_id: optionId, ingredient_id: ing, quantity_delta: parsed }),
    [bo.recipe(productId), MENU_KEY],
    { onSuccess: () => (setIng(""), setQ("")) },
  );
  const used = new Set(lines.map((l) => l.ingredient_id));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const unit = byId.get(ing)?.unit;
  return (
    <div className="flex flex-col gap-2 border-t border-line bg-paper px-3 pb-3 pt-2">
      {lines.length > 0 && (
        <div className="rounded-[10px] border border-line bg-card">
          {lines.map((l, i) => (
            <ModifierRow key={`${l.id}-${l.quantity_delta}`} line={l} ing={byId.get(l.ingredient_id)} first={i === 0} productId={productId} />
          ))}
        </div>
      )}
      <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) 100px auto" }}>
        <Select value={ing} onChange={setIng} className="!py-2 !text-[13px]">
          <option value="">Add ingredient…</option>
          {ingredients
            .filter((i) => i.is_active && !used.has(i.id))
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
        </Select>
        <TextInput value={q} onChange={(v) => setQ(v.replace(/[^\d.-]/g, ""))} placeholder="± qty" suffix={unit} mono style={{ padding: "8px 10px", paddingRight: unit ? 40 : 10, fontSize: 13 }} />
        <Btn kind="secondary" size="sm" disabled={!ing || parsed === null || create.isPending} onClick={() => create.mutate(undefined)}>
          Add
        </Btn>
      </div>
      {create.isError && <ErrorNote>{errorText(create.error)}</ErrorNote>}
    </div>
  );
}

function ProductRecipe({ p }: { p: Product }) {
  const recipe = useRecipe(p.id);
  const ingredients = useIngredients();
  const links = useProductGroups(p.id);
  const [ing, setIng] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const parsed = parseQty(q);
  const create = useBoMutation(() => api.post("/recipe/create", { product_id: p.id, ingredient_id: ing, quantity_per_unit: parsed }), [bo.recipe(p.id), MENU_KEY], {
    onSuccess: () => (setIng(""), setQ("")),
  });

  return (
    <Loadable queries={[recipe, ingredients, links]}>
      {() => {
        const lines = recipe.data!.base;
        const mods = recipe.data!.modifiers;
        const used = new Set(lines.map((l) => l.ingredient_id));
        const byId = new Map(ingredients.data!.map((i) => [i.id, i]));
        const unit = byId.get(ing)?.unit;
        return (
          <div className="flex flex-col gap-3">
            <div className="text-[12.5px] leading-[1.45] text-muted">Deducted from stock each time one is sold. Editing a recipe never changes current stock.</div>
            <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-muted">Base recipe</div>
            <Card>
              {lines.length === 0 && <div className="p-[18px] text-center text-[13px] text-muted">No recipe — sales won&apos;t deduct any stock.</div>}
              {lines.map((l, i) => (
                <RecipeRow key={`${l.id}-${l.quantity_per_unit}`} line={l} ing={byId.get(l.ingredient_id)} first={i === 0} productId={p.id} />
              ))}
            </Card>
            <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) 110px auto" }}>
              <Select value={ing} onChange={setIng}>
                <option value="">Add ingredient…</option>
                {ingredients.data!
                  .filter((i) => i.is_active && !used.has(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
              </Select>
              <TextInput value={q} onChange={(v) => setQ(v.replace(/[^\d.]/g, ""))} placeholder="Qty" suffix={unit} mono inputMode="decimal" style={{ paddingRight: unit ? 40 : 13 }} />
              <Btn kind="primary" disabled={!ing || parsed === null || parsed < 1 || create.isPending} onClick={() => create.mutate(undefined)}>
                Add
              </Btn>
            </div>
            {create.isError && <ErrorNote>{errorText(create.error)}</ErrorNote>}

            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-muted">Option adjustments</div>
            <div className="text-[12px] leading-[1.45] text-muted">
              Added to (or taken from) the base recipe when that option is sold — for this product only. Use negatives for swaps, e.g. Oat milk: Whole milk −180, Oat milk +180.
            </div>
            {links.data!.length === 0 ? (
              <Card pad={16} className="text-center text-[13px] text-muted">
                No option groups on this product. Attach them in the Options tab first.
              </Card>
            ) : (
              links.data!.map((l) => (
                <Card key={l.modifier_group_id}>
                  <div className="border-b border-line bg-paper-2 px-3 py-2 text-[12.5px] font-semibold text-ink-2">{l.modifier_group.name}</div>
                  {l.modifier_group.modifier_option.map((o, i) => {
                    const optLines = mods.filter((m) => m.modifier_option_id === o.id);
                    const isOpen = open === o.id;
                    return (
                      <div key={o.id} className={i ? "border-t border-line" : ""}>
                        <button type="button" onClick={() => setOpen(isOpen ? null : o.id)} className="tap flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
                          <span className="flex-1 text-[14px] font-medium">{o.name}</span>
                          <span className="text-[12px] text-muted">
                            {optLines.length
                              ? optLines.map((m) => `${m.ingredient.name} ${m.quantity_delta > 0 ? "+" : "−"}${qty(Math.abs(m.quantity_delta), m.ingredient.unit)}`).join(" · ")
                              : "No stock change"}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-muted" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
                            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {isOpen && <OptionAdjustments productId={p.id} optionId={o.id} lines={optLines} ingredients={ingredients.data!} />}
                      </div>
                    );
                  })}
                </Card>
              ))
            )}
          </div>
        );
      }}
    </Loadable>
  );
}
