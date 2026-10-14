"use client";

import { useMutation } from "@tanstack/react-query";
import { api, errorText } from "@/lib/api";
import { usePushAlerts, type PushState } from "@/lib/push";
import { useSession } from "@/lib/session";
import { Btn } from "@/components/ui/btn";
import { ErrorNote, Toggle, labelCls } from "@/components/ui/bits";

const HINT: Record<PushState, string> = {
  on: "This device rings for every new Grab order, even when the app is closed.",
  off: "Turn on so this device rings for new Grab orders, even when the app is closed.",
  denied: "Notifications are blocked for this site. Allow them in the browser's site settings, then come back.",
  unsupported: "This browser can't receive push alerts. The counter still shows a banner and chimes while the app is open.",
  "needs-install": "On iPhone, first tap Share → Add to Home Screen, then open Ippuku from the Home Screen and turn this on.",
  "server-off": "Push isn't set up on the server yet (VAPID keys).",
};

// Settings → "Grab order alerts" for this device
export function PushAlerts() {
  const { state, busy, error, enable, disable } = usePushAlerts();
  const { data: user } = useSession();
  const test = useMutation({ mutationFn: () => api.post<{ sent: number; failed: number }>("/push/test") });

  if (!state) return null;
  const on = state === "on";
  const canToggle = on || state === "off";

  return (
    <div className="flex flex-col gap-2.5">
      <div className={labelCls}>Grab order alerts</div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink">Push alerts on this device</div>
          <div className="mt-0.5 text-[12px] leading-[1.4] text-muted">{HINT[state]}</div>
        </div>
        <div className="shrink-0">
          <Toggle on={on} disabled={busy || !canToggle} onChange={(v) => (v ? enable() : disable())} />
        </div>
      </div>
      {on && user?.role === "OWNER" && (
        <div className="flex items-center gap-3">
          <Btn kind="secondary" disabled={test.isPending} onClick={() => test.mutate()}>
            {test.isPending ? "Sending…" : "Send test alert"}
          </Btn>
          {test.isSuccess && (
            <span className="text-[12.5px] text-muted">
              Sent to {test.data.sent} device{test.data.sent === 1 ? "" : "s"}
              {test.data.failed ? `, ${test.data.failed} failed` : ""}
            </span>
          )}
        </div>
      )}
      {(error || test.isError) && <ErrorNote>{error ?? errorText(test.error)}</ErrorNote>}
    </div>
  );
}
