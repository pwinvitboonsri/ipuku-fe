import type { Metadata } from "next";
import { PinLogin } from "@/components/counter/pin-login";

export const metadata: Metadata = { title: "Sign in · Ippuku POS" };

export default function LoginPage() {
  return (
    <main className="flex h-full flex-col">
      <PinLogin />
    </main>
  );
}
