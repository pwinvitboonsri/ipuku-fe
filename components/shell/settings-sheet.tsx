"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { Sheet } from "@/components/ui/sheet";
import { labelCls } from "@/components/ui/bits";
import { SETTINGS_SECTIONS, type SettingsSection } from "./settings/registry";

function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-muted" style={back ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Own component so the section's useSummary hook runs in a stable spot.
function SectionRow({ section, onOpen }: { section: SettingsSection; onOpen: () => void }) {
  const summary = section.useSummary?.();
  return (
    <button type="button" onClick={onOpen} className="tap flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{section.label}</div>
        {summary && <div className="mt-0.5 truncate text-[12px] leading-[1.4] text-muted">{summary}</div>}
      </div>
      <Chevron />
    </button>
  );
}

// Device settings, opened from the account menu over whatever screen is showing.
// Index of sections from the registry; tapping one opens its panel with a back button.
export function SettingsSheet({ onClose, initial }: { onClose: () => void; initial?: string }) {
  const isOwner = useSession().data?.role === "OWNER";
  const sections = SETTINGS_SECTIONS.filter((s) => !s.ownerOnly || isOwner);
  const [openId, setOpenId] = useState<string | null>(initial ?? null);
  const open = sections.find((s) => s.id === openId);

  if (open) {
    return (
      <Sheet
        width={open.width ?? 520}
        onClose={onClose}
        title={
          <button type="button" onClick={() => setOpenId(null)} className="tap -ml-1 flex items-center gap-2 rounded-[8px] px-1 text-left">
            <Chevron back />
            {open.label}
          </button>
        }
        sub={open.group}
      >
        <div key={open.id} className="screen-enter">
          <open.Panel />
        </div>
      </Sheet>
    );
  }

  const groups = [...new Set(sections.map((s) => s.group))];
  return (
    <Sheet title="Settings" sub="For this tablet" onClose={onClose} width={520}>
      <div className="screen-enter flex flex-col gap-3.5">
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <span className={labelCls}>{g}</span>
            <div className="overflow-hidden rounded-[14px] border border-line bg-card">
              {sections
                .filter((s) => s.group === g)
                .map((s) => (
                  <SectionRow key={s.id} section={s} onOpen={() => setOpenId(s.id)} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
