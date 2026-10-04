"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { UNAUTHORIZED_EVENT, api } from "@/lib/api";
import { CartProvider } from "@/lib/cart";
import { clock } from "@/lib/format";
import { qk, useCurrentShift, useOnline, useSession, useSignOut } from "@/lib/session";
import { staffTone } from "@/lib/tone";
import type { SessionStaff } from "@/lib/types";
import { GlassTabs } from "@/components/ui/glass-tabs";
import { Spinner } from "@/components/ui/bits";
import { MyPinSheet } from "@/components/counter/my-pin-sheet";

const IDLE_LOCK_MS = 5 * 60_000;
const COUNTER_ROUTES = ["/sell", "/orders", "/close"];
const SHIFT_ROUTES = ["/sell", "/orders"];

export function Brandmark({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-baseline gap-2.5 whitespace-nowrap">
      <span className="serif-i leading-none tracking-[-0.5px] text-ink" style={{ fontSize: small ? 22 : 26 }}>
        Ippuku
      </span>
      <span className="hidden whitespace-nowrap text-[11px] font-semibold tracking-[1.5px] text-muted sm:inline">一服 · COUNTER 1</span>
    </div>
  );
}

function OfflineBanner() {
  return (
    <div className="flex shrink-0 items-center gap-2.5 bg-persimmon px-3 py-2 text-[12.5px] font-medium leading-snug text-white sm:px-[18px] sm:text-[13px]">
      <span className="h-2 w-2 shrink-0 rounded-full bg-white" style={{ animation: "pulse 1.4s ease infinite" }} />
      <span className="min-w-0">Can&apos;t reach the server — you can build a cart, but charging is paused until it&apos;s back.</span>
      <span className="mono ml-auto hidden shrink-0 text-[12px] opacity-80 sm:inline">/health · retrying</span>
    </div>
  );
}

function AccountMenu({ onClose, onMyPin, onSignOut }: { onClose: () => void; onMyPin: () => void; onSignOut: () => void }) {
  const item = "tap w-full rounded-[8px] px-3.5 py-[11px] text-left text-[14px] font-medium";
  return (
    <div className="absolute inset-0 z-[35]" onClick={onClose}>
      <div className="modal-card absolute right-3 top-[52px] w-[220px] max-w-[calc(100%-24px)] rounded-[12px] border border-line bg-card p-1.5 shadow-lg sm:right-[18px]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={item} onClick={onMyPin}>
          Change my PIN
        </button>
        <button type="button" className={`${item} text-persimmon-2`} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

function AppHeader({ user, shiftSince, onAccount }: { user: SessionStaff; shiftSince?: string; onAccount: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOwner = user.role === "OWNER";
  const mode = pathname.startsWith("/backoffice") ? "bo" : "counter";
  const bare = pathname === "/open-shift";
  const counterTab = COUNTER_ROUTES.find((r) => pathname.startsWith(r)) ?? "/sell";

  const openOrders = useQuery({
    queryKey: qk.openOrders,
    queryFn: () => api.list<unknown[]>("/order", { status: "OPEN" }),
    select: (r) => (typeof r.meta?.total === "number" ? r.meta.total : Array.isArray(r.data) ? r.data.length : 0),
    enabled: mode === "counter" && !bare,
  });

  return (
    // One row on wide screens (as designed); below 1100px: [brand · account] then a scrollable tabs row.
    <header className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line bg-paper px-3 py-2.5 sm:px-[18px] min-[1100px]:flex-nowrap min-[1100px]:py-3 short-land:flex-nowrap short-land:py-2">
      <Brandmark small />
      {!bare && (
        <div className="scroll order-3 -mx-3 flex w-[calc(100%+24px)] min-w-0 items-center gap-3.5 overflow-x-auto px-3 sm:-mx-[18px] sm:w-[calc(100%+36px)] sm:px-[18px] min-[1100px]:order-none min-[1100px]:mx-0 min-[1100px]:w-auto min-[1100px]:overflow-visible min-[1100px]:px-0 short-land:order-none short-land:mx-0 short-land:w-auto short-land:flex-1 short-land:px-0">
          {isOwner && (
            <div className="shrink-0">
              <GlassTabs
                value={mode}
                onChange={(m) => router.push(m === "bo" ? "/backoffice" : "/sell")}
                items={[
                  { id: "counter", label: "Counter" },
                  { id: "bo", label: "Back office" },
                ]}
              />
            </div>
          )}
          {mode === "counter" && (
            <nav className="shrink-0" style={{ marginLeft: isOwner ? 0 : 8 }}>
              <GlassTabs
                value={counterTab}
                onChange={(r) => router.push(r)}
                items={[
                  { id: "/sell", label: "Sell" },
                  { id: "/orders", label: "Orders", badge: openOrders.data ?? 0 },
                  { id: "/close", label: "Close shift" },
                ]}
              />
            </nav>
          )}
        </div>
      )}
      <div className="hidden flex-1 min-[1100px]:block" />
      <button type="button" onClick={onAccount} aria-label="Account" className="tap ml-auto flex shrink-0 items-center gap-2.5 rounded-full bg-paper-2 p-1 sm:pr-2.5 min-[1100px]:ml-0 short-land:pr-1">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-semibold text-paper" style={{ background: staffTone(user.id) }}>
          {user.name[0]}
        </div>
        <div className="hidden flex-col text-left leading-[1.15] sm:flex short-land:hidden">
          <span className="whitespace-nowrap text-[13px] font-semibold">{user.name}</span>
          <span className="whitespace-nowrap text-[11px] text-muted">
            {isOwner ? "Owner" : "Staff"}
            {!bare && shiftSince ? ` · shift since ${shiftSince}` : ""}
          </span>
        </div>
      </button>
    </header>
  );
}

// Signs the tablet out after 5 minutes with no touch or key input.
function useIdleLock(onIdle: () => void) {
  useEffect(() => {
    let t = setTimeout(onIdle, IDLE_LOCK_MS);
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(onIdle, IDLE_LOCK_MS);
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onIdle]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const shift = useCurrentShift(session.isSuccess);
  const online = useOnline();
  const signOut = useSignOut();
  const [account, setAccount] = useState(false);
  const [myPin, setMyPin] = useState(false);
  useIdleLock(signOut);

  // Any 401 from the API (expired token) or a missing session sends the tablet back to sign-in.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);
  useEffect(() => {
    if (session.isError) signOut();
  }, [session.isError, signOut]);

  // Sell and Orders need an open shift; the open-shift screen needs none.
  // /close handles it itself so the "shift closed" summary isn't redirected away.
  const needsShift = SHIFT_ROUTES.some((r) => pathname.startsWith(r));
  const noShift = shift.isSuccess && !shift.data;
  useEffect(() => {
    if (needsShift && noShift) router.replace("/open-shift");
    else if (pathname === "/open-shift" && shift.isSuccess && shift.data) router.replace("/sell");
  }, [needsShift, noShift, pathname, shift.isSuccess, shift.data, router]);

  if (session.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Session ended — returning to sign in…" />
      </div>
    );
  }
  if (!session.data || (needsShift && (shift.isPending || noShift))) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const opened = shift.data?.open_at;

  return (
    <div className="relative flex h-full flex-col bg-paper">
      <AppHeader user={session.data} shiftSince={opened ? clock(opened) : undefined} onAccount={() => setAccount((a) => !a)} />
      {!online && <OfflineBanner />}
      <CartProvider>
        <div key={pathname.startsWith("/backoffice") ? "bo" : pathname} className="screen-enter relative flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </CartProvider>
      {account && (
        <AccountMenu
          onClose={() => setAccount(false)}
          onMyPin={() => {
            setAccount(false);
            setMyPin(true);
          }}
          onSignOut={() => {
            setAccount(false);
            signOut();
          }}
        />
      )}
      {myPin && <MyPinSheet onClose={() => setMyPin(false)} />}
    </div>
  );
}
