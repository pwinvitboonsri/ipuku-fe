"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { MENU_KEY, bahtText, bo, parseBaht, useBoMutation, useGroups } from "@/lib/backoffice";
import { money } from "@/lib/format";
import { useMenu } from "@/lib/menu";
import { useTwoPane } from "@/lib/orientation";
import type { ModifierGroupRow, ModifierOptionRow } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, PageHead, Pill, Toggle } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { BackButton, Loadable } from "./common";

const KEYS = [bo.groups, MENU_KEY];
const digits = (v: string) => v.replace(/\D/g, "");
const activeOpts = (g: ModifierGroupRow) => g.modifier_option.filter((o) => o.is_active).length;

function rangeError(min: string, max: string) {
  if (min === "" || max === "") return "Enter both numbers";
  if (Number(max) < 1) return "Max must be at least 1";
  if (Number(max) < Number(min)) return "Max must be ≥ min";
  return null;
}

function GroupCreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (g: ModifierGroupRow) => void }) {
  const [name, setName] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");
  const err = rangeError(min, max);
  const create = useBoMutation(
    () => api.post<ModifierGroupRow>("/modifier-group/create", { name: name.trim(), min_select: Number(min), max_select: Number(max), is_active: true }),
    KEYS,
    { onSuccess: onCreated },
  );
  return (
    <Sheet
      title="New option group"
      sub="Reusable across products — e.g. Size, Milk, Sweetness."
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!name.trim() || !!err || create.isPending} onClick={() => create.mutate(undefined)}>
            {create.isPending ? "Adding…" : "Add group"}
          </Btn>
        </>
      }
    >
      <Field label="Name">
        <TextInput value={name} onChange={setName} placeholder="e.g. Size" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min select" hint={Number(min) >= 1 ? "Required" : "Optional"}>
          <TextInput value={min} onChange={(v) => setMin(digits(v))} mono inputMode="numeric" />
        </Field>
        <Field label="Max select" hint={Number(max) === 1 ? "Radio on counter" : "Checkboxes"} error={err}>
          <TextInput value={max} onChange={(v) => setMax(digits(v))} mono inputMode="numeric" />
        </Field>
      </div>
      <div className="text-[12px] text-muted">Add its options next. A required group can only be attached once it has enough active options.</div>
      {create.isError && <ErrorNote>{errorText(create.error)}</ErrorNote>}
    </Sheet>
  );
}

// Create (option = null) or edit an option's name, price change and order.
function OptionSheet({ group, option, onClose }: { group: ModifierGroupRow; option: ModifierOptionRow | null; onClose: () => void }) {
  const [name, setName] = useState(option?.name ?? "");
  const [delta, setDelta] = useState(option ? bahtText(option.price_delta_satang) : "0");
  const [sort, setSort] = useState(String(option?.sort_order ?? (group.modifier_option.length ? Math.max(...group.modifier_option.map((o) => o.sort_order)) + 1 : 0)));
  const satang = parseBaht(delta);
  const changes: Record<string, unknown> = {};
  if (option) {
    if (name.trim() !== option.name) changes.name = name.trim();
    if (satang !== null && satang !== option.price_delta_satang) changes.price_delta_satang = satang;
    if (sort !== "" && Number(sort) !== option.sort_order) changes.sort_order = Number(sort);
  }
  const save = useBoMutation(
    () =>
      option
        ? api.post(`/modifier-option/${option.id}/update`, changes)
        : api.post("/modifier-option/create", { group_id: group.id, name: name.trim(), price_delta_satang: satang, sort_order: Number(sort), is_active: true }),
    KEYS,
    { onSuccess: onClose },
  );
  const valid = name.trim() !== "" && satang !== null && sort !== "";
  const canSave = valid && (!option || Object.keys(changes).length > 0) && !save.isPending;
  return (
    <Sheet
      title={option ? `Edit option · ${option.name}` : `New option · ${group.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!canSave} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : option ? "Save" : "Add option"}
          </Btn>
        </>
      }
    >
      <Field label="Name">
        <TextInput value={name} onChange={setName} placeholder="e.g. Oat milk" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price change" hint="Can be negative, e.g. −10 for No milk" error={delta && satang === null ? "Enter an amount like 20 or -10" : null}>
          <TextInput value={delta} onChange={(v) => setDelta(v.replace(/[^\d.-]/g, ""))} prefix="฿" mono />
        </Field>
        <Field label="Order" hint="Lower shows first">
          <TextInput value={sort} onChange={(v) => setSort(digits(v))} mono inputMode="numeric" />
        </Field>
      </div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

function GroupDetail({ g, usedBy }: { g: ModifierGroupRow; usedBy: number }) {
  const [name, setName] = useState(g.name);
  const [min, setMin] = useState(String(g.min_select));
  const [max, setMax] = useState(String(g.max_select));
  const [optSheet, setOptSheet] = useState<ModifierOptionRow | "new" | null>(null);
  const err = rangeError(min, max);
  const changes: Record<string, unknown> = {};
  if (name.trim() !== g.name) changes.name = name.trim();
  if (min !== "" && Number(min) !== g.min_select) changes.min_select = Number(min);
  if (max !== "" && Number(max) !== g.max_select) changes.max_select = Number(max);
  const dirty = Object.keys(changes).length > 0;
  const nActive = activeOpts(g);

  const save = useBoMutation(() => api.post(`/modifier-group/${g.id}/update`, changes), KEYS);
  const toggleGroup = useBoMutation(() => api.post(`/modifier-group/${g.id}/update-status`), KEYS);
  const toggleOpt = useBoMutation((id: string) => api.post(`/modifier-option/${id}/update-status`), KEYS);
  const error = save.error ?? toggleGroup.error ?? toggleOpt.error;

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title={
          <span className="flex flex-wrap items-center gap-2">
            {g.name}
            {!g.is_active && <Pill tone="INACTIVE">Inactive</Pill>}
          </span>
        }
        sub={`Used by ${usedBy} active product${usedBy === 1 ? "" : "s"}`}
        right={
          <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
            Active <Toggle on={g.is_active} disabled={toggleGroup.isPending} onChange={() => toggleGroup.mutate(undefined)} />
          </label>
        }
      />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        <div style={{ gridColumn: "span 2" }} className="min-w-0">
          <Field label="Name">
            <TextInput value={name} onChange={setName} />
          </Field>
        </div>
        <Field label="Min select" hint={Number(min) >= 1 ? "Required" : "Optional"}>
          <TextInput value={min} onChange={(v) => setMin(digits(v))} mono inputMode="numeric" />
        </Field>
        <Field label="Max select" hint={Number(max) === 1 ? "Radio on counter" : "Checkboxes"} error={err}>
          <TextInput value={max} onChange={(v) => setMax(digits(v))} mono inputMode="numeric" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Btn kind="primary" size="sm" disabled={!dirty || !!err || !name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending ? "Saving…" : "Save group"}
        </Btn>
      </div>
      <Table minWidth={420}>
        <thead>
          <tr>
            <th className={`${thCls} w-[30px]`}>#</th>
            <th className={thCls}>Option</th>
            <th className={`${thCls} text-right`}>Price change</th>
            <th className={`${thCls} text-right`}>Active</th>
          </tr>
        </thead>
        <tbody>
          {g.modifier_option.map((o, i) => {
            // Can't turn off options a required group still needs
            const lock = o.is_active && nActive - 1 < g.min_select;
            return (
              <tr key={o.id} className="cursor-pointer" style={{ opacity: o.is_active ? 1 : 0.6 }} onClick={() => setOptSheet(o)}>
                <td className={`${tdCls} mono text-muted`}>{i + 1}</td>
                <td className={tdCls}>{o.name}</td>
                <td className={`${tdCls} mono text-right`} style={{ color: o.price_delta_satang < 0 ? "var(--persimmon-2)" : o.price_delta_satang ? "var(--ink)" : "var(--muted)" }}>
                  {o.price_delta_satang > 0 ? "+" : ""}
                  {o.price_delta_satang ? money(o.price_delta_satang) : "—"}
                </td>
                <td className={`${tdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {lock && <span className="text-[11px] text-muted">min {g.min_select}</span>}
                    <Toggle on={o.is_active} disabled={lock || toggleOpt.isPending} onChange={() => toggleOpt.mutate(o.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
          {g.modifier_option.length === 0 && (
            <tr>
              <td colSpan={4} className={`${tdCls} py-6 text-center text-muted`}>
                No options yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <div className="flex flex-wrap items-center gap-2.5">
        <Btn kind="secondary" size="sm" onClick={() => setOptSheet("new")}>
          + Option
        </Btn>
        <span className="text-[12px] text-muted">Tap an option to edit it. Price change can be negative (e.g. No milk −฿10.00).</span>
      </div>
      {error && <ErrorNote>{errorText(error)}</ErrorNote>}
      {optSheet && <OptionSheet group={g} option={optSheet === "new" ? null : optSheet} onClose={() => setOptSheet(null)} />}
    </div>
  );
}

export function OptionGroups() {
  const groups = useGroups();
  const menu = useMenu();
  const twoPane = useTwoPane();
  const [selId, setSelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Loadable queries={[groups]}>
      {() => {
        const list = groups.data!;
        const sel = list.find((g) => g.id === selId) ?? (twoPane ? list[0] : undefined);
        const usedBy = (id: string) => (menu.data ?? []).flatMap((c) => c.products).filter((p) => p.groups.some((g) => g.id === id)).length;

        const rail = (
          <div className="flex flex-col gap-2.5">
            <PageHead
              title="Option groups"
              right={
                <Btn kind="primary" size="sm" onClick={() => setCreating(true)}>
                  + Group
                </Btn>
              }
            />
            <div className="text-[12.5px] text-muted">Reusable across products.</div>
            {list.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setSelId(x.id)}
                className="tap rounded-[10px] px-3 py-2.5 text-left"
                style={{ background: x.id === sel?.id ? "var(--card)" : "transparent", border: `1px solid ${x.id === sel?.id ? "var(--line-2)" : "transparent"}`, opacity: x.is_active ? 1 : 0.6 }}
              >
                <div className="text-[14px] font-semibold">{x.name}</div>
                <div className="text-[12px] text-muted">
                  {x.min_select}–{x.max_select} · {activeOpts(x)}/{x.modifier_option.length} active · {usedBy(x.id)} products
                </div>
              </button>
            ))}
            {list.length === 0 && <Card pad={18} className="text-center text-[13px] text-muted">No option groups yet.</Card>}
          </div>
        );

        return (
          <>
            {twoPane ? (
              <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "minmax(220px, 300px) minmax(0,1fr)" }} data-screen-label="Back office · Option groups">
                <div className="scroll overflow-y-auto border-r border-line p-4" data-noshrink="1">
                  {rail}
                </div>
                <div key={sel?.id} className="scroll fade-swap overflow-y-auto p-5 lg:p-[22px]">
                  {sel ? <GroupDetail key={`${sel.id}-${sel.name}-${sel.min_select}-${sel.max_select}`} g={sel} usedBy={usedBy(sel.id)} /> : <div className="text-[13px] text-muted">Select a group.</div>}
                </div>
              </div>
            ) : (
              <div className="scroll flex-1 overflow-y-auto p-3 sm:p-5" data-screen-label="Back office · Option groups">
                {sel ? (
                  <div className="flex flex-col gap-3">
                    <BackButton label="All groups" onClick={() => setSelId(null)} />
                    <GroupDetail key={`${sel.id}-${sel.name}-${sel.min_select}-${sel.max_select}`} g={sel} usedBy={usedBy(sel.id)} />
                  </div>
                ) : (
                  rail
                )}
              </div>
            )}
            {creating && (
              <GroupCreateSheet
                onClose={() => setCreating(false)}
                onCreated={(g) => {
                  setCreating(false);
                  setSelId(g.id);
                }}
              />
            )}
          </>
        );
      }}
    </Loadable>
  );
}
