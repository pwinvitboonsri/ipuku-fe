"use client";

import { Sheet } from "@/components/ui/sheet";
import { PrinterSettings } from "@/components/print/printer-settings";
import { PushAlerts } from "@/components/pwa/push-alerts";

// Device settings, opened from the account menu over whatever screen is showing.
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Settings" sub="For this tablet" onClose={onClose} width={520}>
      <div className="flex flex-col gap-6">
        <PushAlerts />
        <PrinterSettings />
      </div>
    </Sheet>
  );
}
