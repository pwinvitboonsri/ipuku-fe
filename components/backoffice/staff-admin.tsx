"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { STAFF_LIST_KEY, bo, useBoMutation, useStaffAdmin } from "@/lib/backoffice";
import { useSession } from "@/lib/session";
import { staffTone } from "@/lib/tone";
import type { Role, StaffRow } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, PageHead, Pill, Toggle } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Table, tdCls, thCls } from "@/components/ui/table";
import { Loadable } from "./common";

// GET /auth/staff feeds this screen; GET /auth (login grid, names on orders) is refreshed too.
const KEYS = [bo.staff, STAFF_LIST_KEY];
const pinDigits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

function StaffSheet({ row, lastOwner, onClose }: { row: StaffRow | null; lastOwner: boolean; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [role, setRole] = useState<Role>(row?.role ?? "STAFF");
  const [pin, setPin] = useState("");
  const changes: Record<string, unknown> = {};
  if (row) {
    if (name.trim() !== row.name) changes.name = name.trim();
    if (role !== row.role) changes.role = role;
  }
  const save = useBoMutation(
    () => (row ? api.post("/auth/update", { id: row.id, ...changes }) : api.post("/auth/create", { name: name.trim(), pin, role, isActive: true })),
    KEYS,
    { onSuccess: onClose },
  );
  const canSave = name.trim() && (row ? Object.keys(changes).length > 0 : /^\d{4}$/.test(pin)) && !save.isPending;
  return (
    <Sheet
      title={row ? `Edit · ${row.name}` : "Add staff"}
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!canSave} onClick={() => save.mutate(undefined)}>
            {save.isPending ? "Saving…" : row ? "Save" : "Add staff"}
          </Btn>
        </>
      }
    >
      <Field label="Name">
        <TextInput value={name} onChange={setName} placeholder="e.g. Fah N." autoFocus={!row} />
      </Field>
      <Field label="Role" hint={lastOwner ? "The last active owner can't be made staff." : "Owners can do everything; staff run the counter."}>
        {lastOwner ? (
          <div className="text-[13.5px] font-medium text-ink-2">Owner</div>
        ) : (
          <Segmented<Role>
            value={role}
            onChange={setRole}
            options={[
              { value: "STAFF", label: "Staff" },
              { value: "OWNER", label: "Owner" },
            ]}
          />
        )}
      </Field>
      {!row && (
        <Field label="Starting PIN" hint="4 digits · they can change it from the counter">
          <TextInput type="password" inputMode="numeric" value={pin} onChange={(v) => setPin(pinDigits(v, 4))} placeholder="••••" mono />
        </Field>
      )}
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Sheet>
  );
}

function ResetPinSheet({ row, onClose }: { row: StaffRow; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const reset = useBoMutation(() => api.post("/auth/pin/reset", { id: row.id, new_pin: pin }), KEYS);
  if (reset.isSuccess) {
    return (
      <Sheet title="PIN reset" sub={`Tell ${row.name} the new PIN in person.`} onClose={onClose} footer={<Btn kind="primary" onClick={onClose}>Done</Btn>}>
        <div className="text-[13.5px] text-ink-2">{row.name} can sign in with the new PIN now.</div>
      </Sheet>
    );
  }
  return (
    <Sheet
      title={`Reset PIN · ${row.name}`}
      sub="For someone who forgot theirs. Tell them the new PIN in person."
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!/^\d{4,6}$/.test(pin) || reset.isPending} onClick={() => reset.mutate(undefined)}>
            {reset.isPending ? "Setting…" : "Set new PIN"}
          </Btn>
        </>
      }
    >
      <Field label="New PIN" hint="4–6 digits">
        <TextInput type="password" inputMode="numeric" value={pin} onChange={(v) => setPin(pinDigits(v, 6))} placeholder="••••" mono autoFocus />
      </Field>
      {reset.isError && <ErrorNote>{errorText(reset.error)}</ErrorNote>}
    </Sheet>
  );
}

export function StaffAdmin() {
  const staff = useStaffAdmin();
  const { data: me } = useSession();
  const [sheet, setSheet] = useState<{ type: "add" } | { type: "edit" | "pin"; row: StaffRow } | null>(null);
  const toggle = useBoMutation((id: string) => api.post("/auth/update/status", { id }), KEYS);

  return (
    <Loadable queries={[staff]}>
      {() => {
        const rows = staff.data!;
        const activeOwners = rows.filter((s) => s.role === "OWNER" && s.is_active).length;
        return (
          <div className="scroll relative flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 sm:p-5 lg:p-[22px]" data-screen-label="Back office · Staff">
            <PageHead
              title="Staff"
              sub="Owners can do everything. Staff run the counter."
              right={
                <Btn kind="primary" size="sm" onClick={() => setSheet({ type: "add" })}>
                  + Add staff
                </Btn>
              }
            />
            <Table minWidth={460}>
              <thead>
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Role</th>
                  <th className={thCls} />
                  <th className={`${thCls} text-right`}>Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const lastOwner = s.role === "OWNER" && s.is_active && activeOwners === 1;
                  // The API won't let an owner edit another owner (they can still reset PINs and toggle status)
                  const otherOwner = s.role === "OWNER" && s.id !== me?.id;
                  return (
                    <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.6 }}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-serif font-semibold italic text-paper" style={{ background: staffTone(s.id) }}>
                            {s.name[0]}
                          </div>
                          <span className="font-medium">{s.name}</span>
                          {s.id === me?.id && <span className="text-[11px] text-muted">you</span>}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <Pill tone={s.role}>{s.role === "OWNER" ? "Owner" : "Staff"}</Pill>
                      </td>
                      <td className={tdCls}>
                        <div className="flex gap-1.5">
                          <Btn kind="ghost" size="sm" disabled={otherOwner} onClick={() => setSheet({ type: "edit", row: s })}>
                            Edit
                          </Btn>
                          <Btn kind="ghost" size="sm" disabled={!s.is_active} onClick={() => setSheet({ type: "pin", row: s })}>
                            Reset PIN
                          </Btn>
                        </div>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          {lastOwner && <span className="whitespace-nowrap text-[11px] text-muted">Last owner</span>}
                          <Toggle on={s.is_active} disabled={lastOwner || toggle.isPending} onChange={() => toggle.mutate(s.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {toggle.isError && <ErrorNote>{errorText(toggle.error)}</ErrorNote>}
            <div className="text-[12px] text-muted">Inactive staff don&apos;t appear on the counter sign-in screen. Owners can&apos;t edit another owner&apos;s name or role. Reactivate someone before resetting their PIN.</div>
            {sheet?.type === "add" && <StaffSheet row={null} lastOwner={false} onClose={() => setSheet(null)} />}
            {sheet?.type === "edit" && (
              <StaffSheet row={sheet.row} lastOwner={sheet.row.role === "OWNER" && sheet.row.is_active && activeOwners === 1} onClose={() => setSheet(null)} />
            )}
            {sheet?.type === "pin" && <ResetPinSheet row={sheet.row} onClose={() => setSheet(null)} />}
          </div>
        );
      }}
    </Loadable>
  );
}
