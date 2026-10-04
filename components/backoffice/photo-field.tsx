"use client";

import { useRef, useState } from "react";
import { errorText } from "@/lib/api";
import { uploadProductImage } from "@/lib/image-upload";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, Spinner } from "@/components/ui/bits";
import { ItemPhoto } from "@/components/counter/item-photo";

// Product photo picker. Uploads right away and hands back the public URL (or null to remove);
// the form still decides when to save it, like any other field.
export function PhotoField({
  id,
  name,
  value,
  onChange,
  onBusy,
}: {
  id: string;
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    onBusy?.(true);
    try {
      onChange(await uploadProductImage(file));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      onBusy?.(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink-2">Photo</span>
      <div className="flex items-center gap-3.5">
        <div className="relative w-[84px] shrink-0">
          <ItemPhoto id={id} name={name || "?"} imageUrl={value} size="hero" />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[14px]" style={{ background: "rgba(245,241,232,0.7)" }}>
              <Spinner />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : value ? "Change photo" : "Choose photo"}
            </Btn>
            {value && !busy && (
              <Btn size="sm" kind="dangerSoft" onClick={() => onChange(null)}>
                Remove
              </Btn>
            )}
          </div>
          <span className="text-[12px] leading-[1.4] text-muted">Square photos look best. Resized to 800 px on this device before upload.</span>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
