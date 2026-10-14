"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { errorText } from "@/lib/api";
import { useAckGrab, useUnseenGrabOrders } from "@/lib/grab";
import { money } from "@/lib/format";
import { orderSummary } from "@/lib/orders";
import { Btn } from "@/components/ui/btn";

const RING_EVERY_MS = 3000;

// Browsers only let a page make sound after the user has touched it; the first tap
// anywhere unlocks this context (staff always tap to sign in, so it's ready by then).
let audio: AudioContext | null = null;
function unlockAudio() {
  if (!audio) audio = new AudioContext();
  if (audio.state === "suspended") void audio.resume();
}

// Two short rising tones, loud enough over a coffee grinder
function ring() {
  if (!audio || audio.state !== "running") return;
  const t = audio.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.2);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t + i * 0.22);
    osc.stop(t + i * 0.22 + 0.21);
  });
}

// Full-width banner + repeating chime while a Grab order hasn't been seen.
// The second channel next to push: works on the counter tablet even if notifications are off.
export function GrabAlarm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const unseen = useUnseenGrabOrders(enabled);
  const ack = useAckGrab();
  const orders = unseen.data ?? [];
  const ringing = orders.length > 0;

  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  useEffect(() => {
    if (!ringing) return;
    ring();
    const id = window.setInterval(ring, RING_EVERY_MS);
    return () => window.clearInterval(id);
  }, [ringing]);

  if (!ringing) return null;
  const o = orders[orders.length - 1]; // oldest first: the list is newest first

  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-white sm:px-6" style={{ background: "#00B14F" }}>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-bold">
          🛵 New Grab order {o.grab_order?.short_order_number}
          {orders.length > 1 ? ` (+${orders.length - 1} more)` : ""}
        </div>
        <div className="truncate text-[13.5px] opacity-90">
          #{o.order_number} · {orderSummary(o)} · {money(o.total_satang)}
        </div>
        {ack.isError && <div className="text-[12.5px] font-semibold">{errorText(ack.error)}</div>}
      </div>
      <Btn kind="secondary" onClick={() => router.push(`/orders?highlight=${o.id}`)}>
        View
      </Btn>
      <Btn kind="primary" disabled={ack.isPending} onClick={() => ack.mutate(o.id)}>
        {ack.isPending ? "Saving…" : "Got it"}
      </Btn>
    </div>
  );
}
