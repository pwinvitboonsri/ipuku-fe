"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, errorText } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { rewardNeeds, rewardPreviewResult, unitLabel } from "@/lib/loyalty";
import type { ValidatedReward } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Spinner } from "@/components/ui/bits";
import { inputCls } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

// Chrome on Android has a built-in QR reader; elsewhere the typed fallback code still works
function qrDetector(): Detector | null {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
}

// The customer holds their phone up to the tablet: the front camera by default
function Camera({ facing, onRead, paused }: { facing: "user" | "environment"; onRead: (text: string) => void; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(() => (qrDetector() ? null : "This browser can't read QR codes — type the code instead."));
  const read = useRef(onRead);
  const pausedRef = useRef(paused);
  // the scan loop reads the latest handler/pause without restarting the camera
  useEffect(() => {
    read.current = onRead;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const detector = qrDetector();
    if (!detector) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (!live || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (!live) return;
          if (!pausedRef.current && video.current && video.current.readyState >= 2) {
            const codes = await detector.detect(video.current).catch(() => []);
            if (codes[0]?.rawValue) read.current(codes[0].rawValue);
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        if (live) setProblem("Can't open the camera — allow camera access, or type the code instead.");
      }
    })();

    return () => {
      live = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return (
    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[12px] bg-ink">
      {problem ? (
        <span className="px-6 text-center text-[13px] text-paper opacity-80">{problem}</span>
      ) : (
        <>
          <video ref={video} muted playsInline className="h-full w-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />
          <div className="pointer-events-none absolute inset-[18%] rounded-[14px] border-2 border-white/70" />
          <span className="absolute bottom-2 text-[11.5px] text-white/85">Point the camera at the customer&apos;s phone</span>
        </>
      )}
    </div>
  );
}

// one line describing the rule, for the % / option / buy-X-get-Y types
function rewardSummary(r: ValidatedReward): string {
  const capText = r.max_discount_satang ? ` (max ${money(r.max_discount_satang)})` : "";
  if (r.type === "PERCENT_OFF") return `${r.percent}% off${capText}`;
  if (r.type === "FREE_OPTION") return `Free option${capText}`;
  if (r.type === "BUY_X_GET_Y") return `Buy ${r.buy_qty} get ${r.get_qty}${r.get_percent === 100 ? " free" : ` ${r.get_percent}% off`}`;
  return r.reward_name;
}

const ERRORS: Record<string, { title: string; body: string; tone: "neg" | "warn" | "off" }> = {
  USED: { title: "Code already used", body: "Ask the customer to check LINE — this reward was already redeemed.", tone: "neg" },
  APPLIED: { title: "Code is on another order", body: "It's attached to an open order. Void that order first, or take payment without the reward.", tone: "neg" },
  CANCELLED: { title: "Code was cancelled", body: "Ask the customer to tap the reward again in LINE for a fresh code.", tone: "warn" },
  EXPIRED: { title: "Code expired", body: "Ask the customer to tap the reward again in LINE for a fresh code.", tone: "warn" },
  STALE_QR: { title: "QR has changed", body: "The QR changes every 15 seconds — scan the customer's screen again (a screenshot won't work).", tone: "warn" },
  NOT_ENOUGH: { title: "Not enough points", body: "The member's balance dropped (e.g. after a refund), so this reward can't be used now.", tone: "neg" },
  NOT_FOUND: { title: "Code not found", body: "Check the code on the customer's screen and try again.", tone: "warn" },
  INVALID: { title: "Not a reward code", body: "Scan the QR under the reward in the customer's LINE, or type its 6-character code.", tone: "warn" },
  OFFLINE: {
    title: "Redeem requires internet — try again when online",
    body: "Rewards are checked by the Ippuku server. The order stays open; take payment without the reward or wait.",
    tone: "off",
  },
};

// POS "Scan reward" (loyalty design, Flow 3 steps 4–5). Validating locks nothing: the reward is
// attached when the order is created at Charge, and the server sets the discount.
export function RewardScanSheet({ onClose }: { onClose: () => void }) {
  const cart = useCart();
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [typed, setTyped] = useState("");

  const check = useMutation({ mutationFn: (input: string) => api.post<ValidatedReward>("/loyalty/reward-codes/validate", { input }) });

  function submit(input: string) {
    const value = input.trim();
    if (!value || check.isPending) return;
    check.mutate(value);
  }

  const err = check.error;
  const reason = err instanceof ApiError ? (err.status === 0 ? "OFFLINE" : err.code) : undefined;
  const known = reason ? ERRORS[reason] : undefined;
  const valid = check.data;
  const subtotal = cart.lines.reduce((s, l) => s + l.totalSatang, 0);
  const result = valid ? rewardPreviewResult(valid, cart.lines, subtotal) : null;
  const preview = result?.ok ? result.amount : null;

  if (valid) {
    return (
      <Sheet
        title="Reward"
        onClose={onClose}
        width={420}
        footer={
          <>
            <Btn onClick={() => check.reset()}>Scan another</Btn>
            <Btn
              kind="go"
              disabled={preview === null}
              onClick={() => {
                cart.setReward(valid);
                onClose();
              }}
            >
              Apply to order
            </Btn>
          </>
        }
      >
        <span className="self-start rounded-full bg-matcha px-2.5 py-1 text-[11px] font-bold tracking-[0.6px] text-white">✓ VALID</span>
        <div>
          <div className="text-[20px] font-semibold text-ink">{valid.reward_name}</div>
          <div className="text-[13px] text-muted">
            {valid.member.display_name ?? "Member"} · <span className="mono">{valid.member.label}</span> · {valid.from_coupon ? "coupon" : `${valid.cost_points} ${unitLabel(valid.cost_currency)}`}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-card p-3.5 text-[13px]">
          {valid.type === "FREE_ITEM" && (
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">Applies to</span>
              <b>{valid.product?.name ?? "—"}</b>
            </div>
          )}
          {valid.type !== "FREE_ITEM" && valid.type !== "FIXED_DISCOUNT" && (
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">Reward</span>
              <b>{rewardSummary(valid)}</b>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-ink-2">Discount</span>
            <b className="mono">{preview === null ? "—" : `−${money(preview)}`}</b>
          </div>
          {preview === null ? (
            <div className="text-[12px] font-medium text-persimmon-2">{result && !result.ok ? rewardNeeds(valid, result.reason) : "Not valid for this order"}, then apply.</div>
          ) : (
            <div className="text-[11.5px] text-muted">Amount is set by the reward. It can&apos;t be edited at the counter. Points are taken when the order is paid.</div>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Scan reward" sub="From the customer's LINE · Rewards" onClose={onClose} width={440}>
      {err ? (
        <div
          className="flex flex-col gap-2 rounded-[12px] border p-4"
          style={{ background: known?.tone === "neg" ? "#F6DED7" : known?.tone === "off" ? "#DFE4EA" : "#F6ECCB", borderColor: "transparent" }}
        >
          <div className="text-[16px] font-semibold" style={{ color: known?.tone === "neg" ? "#8E3522" : known?.tone === "off" ? "#3D4752" : "#7A5A0E" }}>
            {known?.title ?? "Couldn't check the code"}
          </div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{known?.body ?? errorText(err)}</div>
          <div className="flex justify-end gap-2">
            {reason === "OFFLINE" && check.variables && <Btn onClick={() => submit(check.variables!)}>Retry</Btn>}
            <Btn kind="primary" onClick={() => check.reset()}>
              Scan again
            </Btn>
          </div>
        </div>
      ) : (
        <>
          <Camera facing={facing} onRead={submit} paused={check.isPending} />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="tap text-[12.5px] font-semibold text-ink-2 underline underline-offset-2">
              Switch camera
            </button>
            {check.isPending && <Spinner label="Checking…" />}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(typed);
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type code · K7P 29X"
              className={`${inputCls} mono flex-1 uppercase`}
              autoCapitalize="characters"
              autoCorrect="off"
              maxLength={9}
            />
            <Btn type="submit" disabled={!typed.trim() || check.isPending}>
              Validate
            </Btn>
          </form>
        </>
      )}
    </Sheet>
  );
}
