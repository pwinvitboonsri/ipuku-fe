"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { MENU_KEY, bo, parseBaht, useBoMutation, useCategories, useProducts } from "@/lib/backoffice";
import { money } from "@/lib/format";
import { useMenu } from "@/lib/menu";
import { useMediaQuery } from "@/lib/orientation";
import type { Category, Product } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, PageHead, Pill, Toggle } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { ItemPhoto } from "@/components/counter/item-photo";
import { PhotoField } from "./photo-field";
import { BackButton, Loadable, Move, Select, swap } from "./common";
import { ProductDetail } from "./product-detail";

const PRODUCT_KEYS = [bo.products, MENU_KEY];
const CATEGORY_KEYS = [bo.categories, MENU_KEY];

// Categories with display order, names and active state. "+ Category" and "Edit order & names" both open this.
function CategorySheet({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [rows, setRows] = useState(() => categories.map((c) => ({ ...c })));
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const toggle = useBoMutation((id: string) => api.post(`/category/${id}/update-status`), CATEGORY_KEYS);
  const create = useBoMutation(
    (name: string) => api.post<Category>("/category/create", { name, sort_order: rows.length, is_active: true }),
    CATEGORY_KEYS,
    { onSuccess: (c) => (setRows((r) => [...r, c]), setNewName("")) },
  );
  const save = useBoMutation(async () => {
    // Only send what changed — the API rejects updates with no changes
    for (const [i, r] of rows.entries()) {
      const orig = categories.find((c) => c.id === r.id);
      if (!orig) continue;
      const body: { name?: string; sort_order?: number } = {};
      if (r.name.trim() !== orig.name) body.name = r.name.trim();
      if (i !== orig.sort_order) body.sort_order = i;
      if (Object.keys(body).length) await api.post(`/category/${r.id}/update`, body);
    }
  }, CATEGORY_KEYS, { onSuccess: onClose });

  const dirty = rows.some((r, i) => {
    const o = categories.find((c) => c.id === r.id);
    return o && (o.name !== r.name.trim() || o.sort_order !== i);
  });
  const blank = rows.some((r) => !r.name.trim());

  return (
    <Sheet
      title="Categories"
      sub="Order here is the tab order on the counter. Deactivate instead of deleting."
      width={520}
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Close
          </Btn>
          <Btn kind="primary" disabled={!dirty || blank || save.isPending} onClick={() => save.mutate(undefined, { onError: (e) => setErr(errorText(e)) })}>
            {save.isPending ? "Saving…" : "Save order & names"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col rounded-[12px] border border-line bg-card">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-2.5 px-3 py-2 ${i ? "border-t border-line" : ""}`} style={{ opacity: r.is_active ? 1 : 0.6 }}>
            <Move first={i === 0} last={i === rows.length - 1} onUp={() => setRows((l) => swap(l, i, i - 1))} onDown={() => setRows((l) => swap(l, i, i + 1))} />
            <span className="mono w-4 text-[11px] text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <TextInput value={r.name} onChange={(v) => setRows((l) => l.map((x) => (x.id === r.id ? { ...x, name: v } : x)))} style={{ padding: "8px 10px", fontSize: 13.5 }} />
            </div>
            <Toggle on={r.is_active} onChange={() => toggle.mutate(r.id, { onSuccess: () => setRows((l) => l.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x))) })} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TextInput value={newName} onChange={setNewName} placeholder="New category name" />
        </div>
        <Btn kind="primary" disabled={!newName.trim() || create.isPending} onClick={() => create.mutate(newName.trim(), { onError: (e) => setErr(errorText(e)) })}>
          Add
        </Btn>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
    </Sheet>
  );
}

function ProductCreateSheet({ categories, defaultCategory, onClose, onCreated }: { categories: Category[]; defaultCategory: string; onClose: () => void; onCreated: (p: Product) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cat, setCat] = useState(defaultCategory);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const satang = parseBaht(price);
  const create = useBoMutation(
    () => api.post<Product>("/product/create", { name: name.trim(), price_satang: satang, category_id: cat, is_active: true, ...(image && { image_url: image }) }),
    PRODUCT_KEYS,
    { onSuccess: (p) => onCreated(p) },
  );
  const ok = name.trim() && satang !== null && satang >= 0 && cat && !uploading && !create.isPending;
  return (
    <Sheet
      title="New product"
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!ok} onClick={() => create.mutate(undefined)}>
            {create.isPending ? "Adding…" : "Add product"}
          </Btn>
        </>
      }
    >
      <Field label="Name">
        <TextInput value={name} onChange={setName} placeholder="e.g. Matcha Latte" autoFocus />
      </Field>
      <Field label="Price" hint="VAT included" error={price && satang === null ? "Enter an amount like 85 or 85.50" : null}>
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
      <PhotoField id="new-product" name={name} value={image} onChange={setImage} onBusy={setUploading} />
      {create.isError && <ErrorNote>{errorText(create.error)}</ErrorNote>}
    </Sheet>
  );
}

export function MenuAdmin() {
  const categories = useCategories();
  const products = useProducts();
  const menu = useMenu();
  const side = useMediaQuery("(min-width: 1180px)", true);
  const [catId, setCatId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"category" | "product" | null>(null);
  const toggle = useBoMutation((id: string) => api.post(`/product/${id}/update-status`), PRODUCT_KEYS);

  return (
    <Loadable queries={[categories, products]}>
      {() => {
        const cats = categories.data!.filter((c) => showInactive || c.is_active);
        const cat = cats.find((c) => c.id === catId) ?? cats[0];
        const all = products.data!;
        const rows = all.filter((p) => p.category_id === cat?.id && (showInactive || p.is_active));
        const sel = all.find((p) => p.id === selId);
        // /menu has groups per active product; used for the Options column
        const groupNames = new Map((menu.data ?? []).flatMap((c) => c.products.map((p) => [p.id, p.groups.map((g) => g.name).join(", ")] as const)));

        const list = (
          <div className="flex min-w-0 flex-col gap-3.5">
            <PageHead
              title="Menu"
              sub="Deactivate instead of deleting — inactive items disappear from the counter."
              right={
                <>
                  <Btn kind="secondary" size="sm" onClick={() => setSheet("category")}>
                    + Category
                  </Btn>
                  <Btn kind="primary" size="sm" disabled={!categories.data!.length} onClick={() => setSheet("product")}>
                    + Product
                  </Btn>
                </>
              }
            />
            <div className="flex flex-wrap items-center gap-2.5">
              {cats.length > 0 && (
                <div className="scroll max-w-full overflow-x-auto">
                  <GlassTabs
                    value={cat?.id ?? ""}
                    onChange={setCatId}
                    items={cats.map((c, i) => ({
                      id: c.id,
                      label: (
                        <span className="flex items-center gap-2" style={{ opacity: c.is_active ? 1 : 0.55 }}>
                          <span className="mono text-[10.5px] opacity-55">{i + 1}</span>
                          {c.name}
                        </span>
                      ),
                      count: all.filter((p) => p.category_id === c.id && (showInactive || p.is_active)).length,
                    }))}
                  />
                </div>
              )}
              <button type="button" onClick={() => setSheet("category")} className="tap text-[12.5px] text-muted underline underline-offset-[3px]">
                Edit order &amp; names
              </button>
              <div className="flex-1" />
              <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <Toggle on={showInactive} onChange={setShowInactive} /> Show inactive
              </label>
            </div>
            {cats.length === 0 ? (
              <div className="rounded-[14px] border border-line bg-card p-8 text-center text-[13.5px] text-muted">No categories yet. Add one to start building the menu.</div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={thCls}>Product</th>
                    <th className={`${thCls} text-right`}>Price</th>
                    <th className={`${thCls} hidden md:table-cell`}>Options</th>
                    <th className={`${thCls} text-right`}>Active</th>
                  </tr>
                </thead>
                <tbody key={cat?.id}>
                  {rows.map((p) => (
                    <tr key={p.id} onClick={() => setSelId(p.id)} className="cursor-pointer" style={{ background: p.id === selId ? "var(--paper-2)" : "transparent", opacity: p.is_active ? 1 : 0.6 }}>
                      <td className={tdCls}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-[30px] shrink-0">
                            <ItemPhoto id={p.id} name={p.name} imageUrl={p.image_url} size="line" />
                          </div>
                          <span className="min-w-0 font-medium">{p.name}</span>
                          {!p.is_active && <Pill tone="INACTIVE">Inactive</Pill>}
                        </div>
                      </td>
                      <td className={`${tdCls} mono whitespace-nowrap text-right`}>{money(p.price_satang)}</td>
                      <td className={`${tdCls} hidden text-[12.5px] text-muted md:table-cell`}>{groupNames.get(p.id) || "—"}</td>
                      <td className={`${tdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <Toggle on={p.is_active} onChange={() => toggle.mutate(p.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className={`${tdCls} py-8 text-center text-muted`}>
                        No products in this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            )}
            {toggle.isError && <ErrorNote>{errorText(toggle.error)}</ErrorNote>}
          </div>
        );

        const detail = sel && (
          <ProductDetail key={sel.id} p={sel} categories={categories.data!} onClose={() => setSelId(null)} />
        );

        return (
          <>
            {side ? (
              <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: sel ? "minmax(0,1fr) 440px" : "minmax(0,1fr)" }} data-screen-label="Back office · Menu">
                <div className="scroll overflow-y-auto p-[22px]">{list}</div>
                {sel && (
                  <div key={sel.id} className="scroll panel-in overflow-y-auto border-l border-line bg-paper p-5">
                    {detail}
                  </div>
                )}
              </div>
            ) : (
              <div className="scroll flex-1 overflow-y-auto p-3 sm:p-5" data-screen-label="Back office · Menu">
                {sel ? (
                  <div className="flex flex-col gap-3">
                    <BackButton label="All products" onClick={() => setSelId(null)} />
                    {detail}
                  </div>
                ) : (
                  list
                )}
              </div>
            )}
            {sheet === "category" && <CategorySheet categories={categories.data!} onClose={() => setSheet(null)} />}
            {sheet === "product" && cat && (
              <ProductCreateSheet
                categories={categories.data!}
                defaultCategory={cat.id}
                onClose={() => setSheet(null)}
                onCreated={(p) => {
                  setSheet(null);
                  setCatId(p.category_id);
                  setSelId(p.id);
                }}
              />
            )}
          </>
        );
      }}
    </Loadable>
  );
}

