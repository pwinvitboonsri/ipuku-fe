"use client";

import { money } from "@/lib/format";
import type { CartLine } from "@/lib/cart";
import type { MenuGroup, MenuOption, MenuProduct } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Sheet } from "@/components/ui/sheet";
import { ItemPhoto } from "./item-photo";

// Sheets a scanned reward may need: which item is free, which drink gets the free option,
// and the check at Charge when the reward still isn't used.

export function ProductPickSheet({ reward, products, onPick, onClose }: { reward: string; products: MenuProduct[]; onPick: (p: MenuProduct) => void; onClose: () => void }) {
  return (
    <Sheet title="Which item is free?" sub={`${reward} · base price free, extras charged`} onClose={onClose} width={560}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {products.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p)} className="tap flex flex-col gap-2 rounded-[12px] border border-line bg-card p-2.5 text-left">
            <ItemPhoto id={p.id} name={p.name} imageUrl={p.image_url} size="card" />
            <span className="text-[13.5px] font-semibold leading-tight">{p.name}</span>
            <span className="mono text-[12px] text-muted">{money(p.price_satang)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export type LineChoice = { lineKey: string; product: MenuProduct; option: MenuOption; group: MenuGroup };

export function LinePickSheet({ reward, choices, lines, onPick, onClose }: { reward: string; choices: LineChoice[]; lines: CartLine[]; onPick: (c: LineChoice) => void; onClose: () => void }) {
  return (
    <Sheet title={`Which item gets ${choices[0]?.option.name ?? "it"}?`} sub={reward} onClose={onClose} width={460}>
      <div className="flex flex-col gap-2">
        {choices.map((c) => {
          const line = lines.find((l) => l.key === c.lineKey);
          return (
            <button key={c.lineKey} type="button" onClick={() => onPick(c)} className="tap flex items-center justify-between gap-3 rounded-[12px] border border-line bg-card px-3.5 py-3 text-left">
              <span>
                <b className="text-[14px] font-semibold">{c.product.name}</b>
                {line?.mods.length ? <span className="block text-[12px] text-muted">{line.mods.join(" · ")}</span> : null}
              </span>
              <span className="text-[12.5px] font-semibold text-matcha">+ {c.option.name}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// Charge with a reward that doesn't apply yet: finish the order, or give the reward back and charge without it
export function UnusedRewardSheet({ reward, needs, onBack, onRelease }: { reward: string; needs?: string; onBack: () => void; onRelease: () => void }) {
  return (
    <Sheet
      title={`${reward} isn't used`}
      sub={needs ? `${needs}.` : "It doesn't apply to this order yet."}
      onClose={onBack}
      width={440}
      footer={
        <>
          <Btn onClick={onRelease}>Give back &amp; charge</Btn>
          <Btn kind="primary" onClick={onBack}>
            Back to order
          </Btn>
        </>
      }
    >
      <div className="text-[13px] leading-[1.5] text-ink-2">
        Add what the reward needs, or give it back: it returns to the customer&apos;s LINE and nothing is spent.
      </div>
    </Sheet>
  );
}
