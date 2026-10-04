"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { Btn } from "@/components/ui/btn";
import { ErrorNote } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
const valid = (s: string) => /^\d{4,6}$/.test(s);

// POST /auth/pin/change { old_pin, new_pin }
export function MyPinSheet({ onClose }: { onClose: () => void }) {
  const [oldP, setOld] = useState("");
  const [newP, setNew] = useState("");
  const [conf, setConf] = useState("");
  const change = useMutation({
    mutationFn: () => api.post("/auth/pin/change", { old_pin: oldP, new_pin: newP }),
  });

  const mismatch = conf.length >= 4 && conf !== newP;
  const ok = valid(oldP) && valid(newP) && newP === conf && newP !== oldP;

  if (change.isSuccess) {
    return (
      <Sheet title="PIN changed" sub="Use your new PIN next time you sign in." onClose={onClose} footer={<Btn kind="primary" onClick={onClose}>Done</Btn>}>
        <div className="text-[13.5px] text-ink-2">Your PIN has been updated.</div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Change my PIN"
      sub="4–6 digits. You'll use it next time you sign in."
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!ok || change.isPending} onClick={() => change.mutate()}>
            {change.isPending ? "Changing…" : "Change PIN"}
          </Btn>
        </>
      }
    >
      <Field label="Current PIN">
        <TextInput type="password" inputMode="numeric" value={oldP} onChange={(v) => setOld(digits(v))} mono autoFocus />
      </Field>
      <Field label="New PIN" hint="4–6 digits" error={newP && !valid(newP) ? "Use 4 to 6 digits" : newP && newP === oldP ? "Pick a different PIN" : null}>
        <TextInput type="password" inputMode="numeric" value={newP} onChange={(v) => setNew(digits(v))} mono />
      </Field>
      <Field label="Confirm new PIN" error={mismatch ? "PINs don't match" : null}>
        <TextInput type="password" inputMode="numeric" value={conf} onChange={(v) => setConf(digits(v))} mono />
      </Field>
      {change.isError && <ErrorNote>{errorText(change.error)}</ErrorNote>}
    </Sheet>
  );
}
