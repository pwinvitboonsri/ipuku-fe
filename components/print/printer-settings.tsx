"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorText } from "@/lib/api";
import { escpos, printJob, type PaperWidth } from "@/lib/print/escpos";
import { decodePrintImage, preparePrintImage } from "@/lib/print/images";
import { renderSlips, sendSlips } from "@/lib/print/print-order";
import type { RawbtMode } from "@/lib/print/rawbt";
import type { Receipt } from "@/lib/print/receipt";
import { lines, savePrinterSettings, usePrinterSettings, type PrintImage } from "@/lib/print/settings";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, Spinner, Toggle, labelCls } from "@/components/ui/bits";
import { Field, inputCls } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { RawbtPrinterPicker } from "./rawbt-printer-picker";

// Sample with the Thai that usually breaks on printers: stacked vowels + tone marks (ปู่ ผู้ ฟ้า น้ำ).
const SAMPLE: Omit<Receipt, "header" | "footer"> = {
  shop: "Ippuku",
  queue: 1,
  when: new Date(),
  staff: "Admin",
  counter: "001",
  lines: [
    { name: "อเมริกาโน่ เย็น", mods: ["แก้วใหญ่", "หวานน้อย 25%"], qty: 1, unitSatang: 9000, totalSatang: 9000 },
    { name: "ชาเขียวมัทฉะลาเต้ น้ำผึ้ง", mods: ["นมโอ๊ต", "เพิ่มช็อต"], qty: 2, unitSatang: 10500, totalSatang: 21000 },
    { name: "Tea pot", mods: [], qty: 1, unitSatang: 15000, totalSatang: 15000 },
  ],
  totalSatang: 45000,
  payments: [{ label: "เงินสด", amountSatang: 45000 }],
  tenderSatang: 50000,
  changeSatang: 5000,
};

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-[1.4] text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Logo / bottom picture: uploads the original to R2, keeps a print-ready copy on this tablet.
function ImagePick({ label, hint, value, onChange }: { label: string; hint: string; value: PrintImage | null; onChange: (v: PrintImage | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await preparePrintImage(file));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink-2">{label}</span>
      <div className="flex items-center gap-3">
        <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={value.data} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-muted-2">None</span>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(245,241,232,0.75)" }}>
              <Spinner />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : value ? "Change" : "Choose image"}
            </Btn>
            {value && !busy && (
              <Btn size="sm" kind="dangerSoft" onClick={() => onChange(null)}>
                Remove
              </Btn>
            )}
          </div>
          <span className="text-[12px] leading-[1.4] text-muted">{hint}</span>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

type Slip = "ticket" | "receipt";

// Receipt printer section of the Settings sheet. Printing goes through the RawBT app
// (paired with the Bluetooth printer); settings are saved on this tablet only.
export function PrinterSettings() {
  const s = usePrinterSettings();
  const [previewOf, setPreviewOf] = useState<Slip | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<Slip, string>>>({});
  const [sent, setSent] = useState<string | null>(null);
  const job = useRef<Uint8Array | null>(null);
  const [ready, setReady] = useState(false);

  // Pre-render so a tap only hands off (Chrome needs the app switch inside the gesture)
  useEffect(() => {
    let live = true;
    (async () => {
      await document.fonts.ready;
      await Promise.all([decodePrintImage(s.logo), decodePrintImage(s.bottom)]);
      if (!live) return;
      const r: Receipt = { ...SAMPLE, when: new Date(), header: lines(s.header), footer: lines(s.footer) };
      const [ticket, receipt] = [renderSlips(r, s, "ticket")[0], renderSlips(r, s, "receipt")[0]];
      const both = renderSlips(r, s);
      job.current = both.length ? printJob(both, { cut: s.cut }) : null;
      setReady(!!job.current);
      setPreviews({ ticket: ticket.toDataURL(), receipt: receipt.toDataURL() });
    })();
    return () => {
      live = false;
    };
  }, [s]);

  async function send(label: string, bytes: Uint8Array) {
    const at = new Date().toLocaleTimeString("en-GB", { hour12: false });
    try {
      await sendSlips(bytes, s);
      setSent(`${label} · ${bytes.length.toLocaleString()} bytes · sent ${at}`);
    } catch (err) {
      setSent(`${label} · failed ${at} · ${errorText(err)}`);
    }
  }

  function textOnly() {
    const rule = "-".repeat(s.paper === 80 ? 48 : 32);
    return Uint8Array.from([
      ...escpos.init(),
      ...escpos.text(`IPPUKU TEXT TEST\n${new Date().toLocaleString("en-GB")}\n${rule}\nAmericano x1   65.00\nLatte x2      150.00\n${rule}\nTOTAL 215.00\n`),
      ...escpos.feed(4),
      ...(s.cut ? escpos.cut() : []),
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[12.5px] leading-[1.45] text-muted">Ticket and customer receipt. Prints through the RawBT app paired with the Bluetooth printer. Saved on this tablet only.</div>

      <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-card p-4">
        <div className="text-[14px] font-medium text-ink">Print to</div>
        <RawbtPrinterPicker value={s.printer} onChange={(printer) => savePrinterSettings({ printer })} emptyLabel="Printer ticked in RawBT" />
        <div className="text-[12px] leading-[1.4] text-muted">Pick the slip printer by name so stickers can use another one. Needs the “Server for RawBT” app running.</div>
      </div>

      <div className="rounded-[14px] border border-line bg-card p-4">
        <SettingRow label="Print after payment and on orders" hint="Turn off to hide all print buttons.">
          <Toggle on={s.enabled} onChange={(v) => savePrinterSettings({ enabled: v })} />
        </SettingRow>
        <SettingRow label="Print automatically after payment">
          <Toggle on={s.auto} disabled={!s.enabled} onChange={(v) => savePrinterSettings({ auto: v })} />
        </SettingRow>
        <SettingRow label="Ticket" hint="Short slip for the bar: queue number and items, big.">
          <Toggle on={s.ticket} onChange={(v) => savePrinterSettings({ ticket: v })} />
        </SettingRow>
        <SettingRow label="Customer receipt" hint="Logo, shop details, items, payment.">
          <Toggle on={s.receipt} onChange={(v) => savePrinterSettings({ receipt: v })} />
        </SettingRow>
        <SettingRow label="Cut paper" hint="Cuts after each slip, for printers with a cutter.">
          <Toggle on={s.cut} onChange={(v) => savePrinterSettings({ cut: v })} />
        </SettingRow>
        <SettingRow label="Paper width">
          <div className="w-[160px]">
            <Segmented size="sm" value={String(s.paper) as "80" | "58"} onChange={(v) => savePrinterSettings({ paper: Number(v) as PaperWidth })} options={[{ value: "80", label: "80 mm" }, { value: "58", label: "58 mm" }]} />
          </div>
        </SettingRow>
        {!s.printer && (
          <SettingRow label="RawBT link" hint="Switch to “rawbt:” only if RawBT doesn't open.">
            <div className="w-[160px]">
              <Segmented size="sm" value={s.mode} onChange={(v: RawbtMode) => savePrinterSettings({ mode: v })} options={[{ value: "intent", label: "Default" }, { value: "scheme", label: "rawbt:" }]} />
            </div>
          </SettingRow>
        )}
      </div>

      <div className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-card p-4">
        <span className={labelCls}>Customer receipt</span>
        <ImagePick label="Logo" hint="Top of the receipt. Black on white prints best." value={s.logo} onChange={(logo) => savePrinterSettings({ logo })} />
        <Field label="Header lines" hint="Under the shop name — branch, address, phone, tax ID. One per line.">
          <textarea rows={3} defaultValue={s.header} onBlur={(e) => savePrinterSettings({ header: e.target.value })} className={inputCls} placeholder={"สาขา: Headquarters\n2014, 13 Soi Phahon Yothin 34, Bangkok 10900\n063-897-8187"} />
        </Field>
        <Field label="Footer lines" hint="One per line.">
          <textarea rows={2} defaultValue={s.footer} onBlur={(e) => savePrinterSettings({ footer: e.target.value })} className={inputCls} />
        </Field>
        <ImagePick label="Bottom picture" hint="Under the footer, e.g. a stamp or QR code." value={s.bottom} onChange={(bottom) => savePrinterSettings({ bottom })} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn kind="primary" disabled={!ready} onClick={() => job.current && send("Test slips", job.current)} style={{ flex: 1 }}>
          Print test {s.ticket && s.receipt ? "ticket + receipt" : s.ticket ? "ticket" : "receipt"}
        </Btn>
        <Btn kind="secondary" onClick={() => send("Text only", textOnly())}>
          Text only
        </Btn>
      </div>
      {sent && <div className="mono break-words rounded-[10px] bg-paper-2 px-3 py-2 text-[12px] text-ink-2">{sent}</div>}

      <div className="flex items-center gap-2">
        <span className={labelCls}>Preview</span>
        <div className="flex gap-1.5">
          {(["ticket", "receipt"] as Slip[]).map((k) => (
            <Btn key={k} size="sm" kind={previewOf === k ? "primary" : "ghost"} onClick={() => setPreviewOf(previewOf === k ? null : k)}>
              {k === "ticket" ? "Ticket" : "Receipt"}
            </Btn>
          ))}
        </div>
      </div>
      {previewOf &&
        (previews[previewOf] ? (
          // eslint-disable-next-line @next/next/no-img-element -- local canvas data URL
          <img src={previews[previewOf]} alt={`${previewOf} preview`} className="mx-auto w-full max-w-[340px] border border-line bg-white shadow-md" />
        ) : (
          <div className="p-4 text-center text-[13px] text-muted">Rendering…</div>
        ))}
      <div className="text-[12px] leading-[1.5] text-muted">Nothing prints? Open RawBT, check the printer shows as connected, and close any other app using it.</div>
    </div>
  );
}
