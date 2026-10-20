"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorText } from "@/lib/api";
import { printOnRawbt } from "@/lib/print/rawbt-ws";
import { drawSticker, SAMPLE_STICKER, stickerJob } from "@/lib/print/sticker";
import {
  DEFAULT_STICKER_LINES,
  STICKER_TOKENS,
  newLineId,
  saveStickerSettings,
  useStickerSettings,
  type StickerAlign,
  type StickerLine,
  type StickerSettings,
  type StickerSize,
} from "@/lib/print/sticker-settings";
import { Btn } from "@/components/ui/btn";
import { Toggle, labelCls } from "@/components/ui/bits";
import { Field, inputCls } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { RawbtPrinterPicker } from "./rawbt-printer-picker";

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

function MmInput({ label, value, min, max, onSave }: { label: string; value: number; min: number; max: number; onSave: (v: number) => void }) {
  return (
    <Field label={`${label} (mm)`}>
      <input
        type="number"
        inputMode="decimal"
        defaultValue={value}
        key={value}
        min={min}
        max={max}
        onBlur={(e) => {
          const v = Number(e.target.value);
          onSave(Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : value);
        }}
        className={`${inputCls} mono`}
      />
    </Field>
  );
}

// Compact segmented control for the line editor: sized to its labels, so rows wrap instead of overlapping
function MiniSeg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-[8px] border border-line-2 bg-paper-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`tap min-w-[34px] rounded-[6px] px-2.5 py-[5px] text-[12.5px] font-semibold ${value === o.value ? "bg-ink text-paper" : "text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`tap shrink-0 rounded-[8px] border px-3 py-[6px] text-[12.5px] font-semibold ${on ? "border-ink bg-ink text-paper" : "border-line-2 bg-paper-2 text-ink-2"}`}
    >
      {children}
    </button>
  );
}

const iconBtn = "tap flex h-8 w-8 items-center justify-center rounded-[8px] border border-line-2 bg-card text-[14px] text-ink-2 disabled:opacity-35";

function LineEditor({
  line,
  index,
  count,
  active,
  onFocus,
  onChange,
  onMove,
  onDelete,
}: {
  line: StickerLine;
  index: number;
  count: number;
  active: boolean;
  onFocus: () => void;
  onChange: (patch: Partial<StickerLine>) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  // Put a {token} where the cursor is
  function insert(token: string) {
    const el = input.current;
    const at = el?.selectionStart ?? line.text.length;
    const end = el?.selectionEnd ?? at;
    onChange({ text: line.text.slice(0, at) + token + line.text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <span className="mono w-5 shrink-0 text-[12px] text-muted">{index + 1}</span>
        <input ref={input} value={line.text} onFocus={onFocus} onChange={(e) => onChange({ text: e.target.value })} className={`${inputCls} min-w-0 flex-1`} placeholder="Text or {tokens}" />
        <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className={iconBtn}>
          ↑
        </button>
        <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className={iconBtn}>
          ↓
        </button>
        <button type="button" aria-label="Delete line" onClick={onDelete} className={`${iconBtn} text-persimmon-2`}>
          ×
        </button>
      </div>
      {active && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {STICKER_TOKENS.map((t) => (
            <button
              key={t.token}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the input's cursor
              onClick={() => insert(t.token)}
              className="tap rounded-full border border-line-2 bg-paper-2 px-2.5 py-1 text-[12px] font-medium text-ink-2"
            >
              + {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 pl-7">
        <MiniSeg<StickerSize>
          label="Size"
          value={line.size}
          onChange={(size) => onChange({ size })}
          options={[
            { value: "s", label: "S" },
            { value: "m", label: "M" },
            { value: "l", label: "L" },
            { value: "xl", label: "XL" },
          ]}
        />
        <MiniSeg<StickerAlign>
          label="Align"
          value={line.align}
          onChange={(align) => onChange({ align })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Mid" },
            { value: "right", label: "Right" },
          ]}
        />
        <Chip on={line.bold} onClick={() => onChange({ bold: !line.bold })}>
          Bold
        </Chip>
        {index > 0 && (
          <Chip on={line.sameRow} onClick={() => onChange({ sameRow: !line.sameRow })}>
            Same row as above
          </Chip>
        )}
      </div>
    </div>
  );
}

// Sticker printer section of the Settings sheet: which RawBT printer, sticker size, and the
// sticker design (lines of text + {tokens}), with a live preview. Saved on this tablet only.
export function StickerPrinterSettings() {
  const s = useStickerSettings();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    overflow: boolean;
  } | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      await document.fonts.ready;
      if (!live) return;
      const { canvas, overflow } = drawSticker({ ...SAMPLE_STICKER, when: new Date() }, s);
      setPreview({ url: canvas.toDataURL(), overflow });
    })();
    return () => {
      live = false;
    };
  }, [s]);

  const setLines = (fn: (lines: StickerLine[]) => StickerLine[]) => saveStickerSettings({ lines: fn(s.lines) });
  const patchLine = (id: string, patch: Partial<StickerLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const moveLine = (i: number, by: -1 | 1) =>
    setLines((ls) => {
      const next = [...ls];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  function addLine() {
    const line: StickerLine = {
      id: newLineId(),
      text: "",
      size: "m",
      bold: false,
      align: "left",
      sameRow: false,
    };
    setLines((ls) => [...ls, line]);
    setActiveId(line.id);
  }

  async function testPrint() {
    const at = new Date().toLocaleTimeString("en-GB", { hour12: false });
    if (!s.printer) return setSent("Choose the sticker printer first.");
    try {
      const { canvas } = drawSticker({ ...SAMPLE_STICKER, when: new Date() }, s);
      await printOnRawbt(s.printer, stickerJob([canvas], s));
      setSent(`Test sticker · sent ${at}`);
    } catch (err) {
      setSent(`Test sticker · failed ${at} · ${errorText(err)}`);
    }
  }

  const sizePatch = (patch: Partial<StickerSettings>) => saveStickerSettings(patch);

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px] md:gap-5">
      {/* Preview stays in view while editing: beside the settings on wide screens, pinned on top on narrow ones */}
      <div className="sticky top-0 z-10 -mx-1 -mt-1 flex flex-col gap-2 self-start bg-paper px-1 pb-3 pt-1 md:order-last md:mx-0 md:mt-0 md:px-0">
        <span className={labelCls}>Preview</span>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local canvas data URL
          <img src={preview.url} alt="Sticker preview" className="mx-auto w-full max-w-[260px] rounded-[6px] border border-line bg-white shadow-md md:max-w-none" />
        ) : (
          <div className="p-4 text-center text-[13px] text-muted">Rendering…</div>
        )}
        {preview?.overflow && <div className="text-[12px] font-medium text-persimmon-2">The design runs past the bottom of the sticker — make lines smaller or remove one.</div>}
        <Btn kind="primary" disabled={!s.printer} onClick={testPrint}>
          Print test sticker
        </Btn>
        {sent && <div className="mono break-words rounded-[10px] bg-paper-2 px-3 py-2 text-[12px] text-ink-2">{sent}</div>}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="text-[12.5px] leading-[1.45] text-muted">One sticker per cup, on the label printer. Needs the “Server for RawBT” app running. Saved on this tablet only.</div>

        <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-card p-4">
          <div className="text-[14px] font-medium text-ink">Print to</div>
          <RawbtPrinterPicker value={s.printer} onChange={(printer) => saveStickerSettings({ printer })} />
        </div>

        <div className="rounded-[14px] border border-line bg-card p-4">
          <SettingRow label="Print stickers" hint="Turn off to hide all sticker buttons.">
            <Toggle on={s.enabled} onChange={(v) => saveStickerSettings({ enabled: v })} />
          </SettingRow>
          <SettingRow label="Print automatically after payment">
            <Toggle on={s.auto} disabled={!s.enabled} onChange={(v) => saveStickerSettings({ auto: v })} />
          </SettingRow>
          <SettingRow label="Printer language" hint="Receipt mode = ESC/POS. Label mode = TSPL. If a sticker prints as random text, switch this.">
            <div className="w-[160px]">
              <Segmented
                size="sm"
                value={s.lang}
                onChange={(lang: StickerSettings["lang"]) => saveStickerSettings({ lang })}
                options={[
                  { value: "escpos", label: "ESC/POS" },
                  { value: "tspl", label: "TSPL" },
                ]}
              />
            </div>
          </SettingRow>
          {s.lang === "escpos" && (
            <SettingRow label="Cut after each sticker" hint="For a continuous sticker roll (no gaps) on a printer with a cutter.">
              <Toggle on={s.cut} onChange={(v) => saveStickerSettings({ cut: v })} />
            </SettingRow>
          )}
          <SettingRow label="Rotate 180°" hint="If stickers come out upside down.">
            <Toggle on={s.flip} onChange={(v) => saveStickerSettings({ flip: v })} />
          </SettingRow>
        </div>

        <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-card p-4">
          <span className={labelCls}>Sticker size</span>
          <div className={`grid gap-2.5 ${s.lang === "escpos" && s.cut ? "grid-cols-2" : "grid-cols-3"}`}>
            <MmInput label="Width" value={s.width} min={20} max={104} onSave={(width) => sizePatch({ width })} />
            <MmInput label="Height" value={s.height} min={10} max={150} onSave={(height) => sizePatch({ height })} />
            {!(s.lang === "escpos" && s.cut) && <MmInput label="Gap" value={s.gap} min={0} max={10} onSave={(gap) => sizePatch({ gap })} />}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className={labelCls}>Sticker design</span>
            <Btn size="sm" kind="ghost" onClick={() => saveStickerSettings({ lines: DEFAULT_STICKER_LINES })}>
              Reset
            </Btn>
          </div>
          <div className="text-[12px] leading-[1.4] text-muted">
            Each line is text plus values from the order. Tap a line to insert a value. Lines that come out empty (e.g. no options) are skipped.
          </div>
          <div className="flex flex-col">
            {s.lines.map((line, i) => (
              <LineEditor
                key={line.id}
                line={line}
                index={i}
                count={s.lines.length}
                active={activeId === line.id}
                onFocus={() => setActiveId(line.id)}
                onChange={(patch) => patchLine(line.id, patch)}
                onMove={(by) => moveLine(i, by)}
                onDelete={() => setLines((ls) => ls.filter((l) => l.id !== line.id))}
              />
            ))}
          </div>
          <Btn size="sm" onClick={addLine}>
            + Add line
          </Btn>
        </div>
      </div>
    </div>
  );
}
