"use client";

import { useState } from "react";
import { errorText } from "@/lib/api";
import { listRawbtPrinters, type RawbtPrinter } from "@/lib/print/rawbt-ws";
import { Btn } from "@/components/ui/btn";
import { ErrorNote } from "@/components/ui/bits";
import { inputCls } from "@/components/ui/form";

// Last list from RawBT, shared by every picker so switching pages doesn't ask again
let known: RawbtPrinter[] | null = null;

// Picks one of the printers saved in RawBT, by name. The list comes from RawBT's
// local server ("Server for RawBT" app) on tap, since asking needs that app running.
export function RawbtPrinterPicker({ value, onChange, emptyLabel }: { value: string; onChange: (name: string) => void; emptyLabel?: string }) {
  const [printers, setPrinters] = useState<RawbtPrinter[] | null>(known);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setLoading(true);
    setError(null);
    try {
      known = await listRawbtPrinters();
      setPrinters(known);
    } catch (err) {
      setError(`${errorText(err)}. Is the "Server for RawBT" app running?`);
    } finally {
      setLoading(false);
    }
  }

  const options = printers ?? [];
  const missing = value && !options.some((p) => p.name === value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mono min-w-0 flex-1`}>
          {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : !value && <option value="">Choose a printer…</option>}
          {missing && <option value={value}>{value}</option>}
          {options.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <Btn size="sm" disabled={loading} onClick={find}>
          {loading ? "Looking…" : printers ? "Refresh" : "Find printers"}
        </Btn>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
