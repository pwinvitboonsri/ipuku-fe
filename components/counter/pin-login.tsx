"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, errorText, request } from "@/lib/api";
import { firstName } from "@/lib/format";
import { useNow, useStaffList } from "@/lib/session";
import { staffTone } from "@/lib/tone";
import type { SessionStaff, Staff } from "@/lib/types";
import { Btn } from "@/components/ui/btn";

// PinLogin — first screen on app open, after sign-out, and after 5 min idle.
// GET /auth (device-signed by the server) → pick a name → POST /auth/login { id, pin }.
// PINs are 4–6 digits, so submit is explicit (OK) rather than automatic at 4.

const LOGIN_WINDOW_S = 60; // login is limited to 10 attempts/min

function StaffSelector({ staff, selectedId, onSelect }: { staff: Staff[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const mask = "linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent)";
  return (
    <div className="scroll w-full overflow-x-auto pb-2 pt-1" style={{ WebkitMaskImage: mask, maskImage: mask }}>
      <div className="flex justify-center gap-3.5 px-6 py-0.5" style={{ minWidth: "min-content" }}>
        {staff.map((s) => {
          const on = selectedId === s.id;
          return (
            <button key={s.id} type="button" onClick={() => onSelect(s.id)} className="tap flex min-w-[76px] shrink-0 flex-col items-center gap-1.5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full font-serif text-[20px] font-semibold italic text-paper"
                style={{
                  background: staffTone(s.id),
                  boxShadow: on ? "0 0 0 3px var(--paper), 0 0 0 5px var(--ink)" : "0 2px 6px rgba(28,24,20,0.12)",
                  transition: "box-shadow 180ms",
                }}
              >
                {s.name[0]}
              </div>
              <div className={`whitespace-nowrap text-[12px] ${on ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{s.name}</div>
              {s.role && <div className="whitespace-nowrap text-[9.5px] font-medium uppercase tracking-[0.4px] text-muted">{s.role === "OWNER" ? "Owner" : "Staff"}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PinDots({ length, count, error, shaking }: { length: number; count: number; error: boolean; shaking: boolean }) {
  return (
    <div className="flex justify-center gap-4" style={{ animation: shaking ? "pinShake 380ms cubic-bezier(.36,.07,.19,.97)" : "none" }}>
      {Array.from({ length }, (_, i) => {
        const filled = i < count;
        const c = error ? "var(--persimmon)" : "var(--ink)";
        return (
          <div
            key={i}
            className="h-3.5 w-3.5 rounded-full border-2"
            style={{
              background: filled ? c : "transparent",
              borderColor: filled ? c : "var(--line-2)",
              transform: filled ? "scale(1)" : "scale(0.85)",
              transition: "background 120ms, border-color 120ms, transform 100ms",
            }}
          />
        );
      })}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
];

function PadKey({ children, onTap, sub, disabled }: { children: ReactNode; onTap: () => void; sub?: string; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className="tap mono flex h-[var(--key)] w-[var(--key)] flex-col items-center justify-center gap-px rounded-full text-[clamp(20px,3.2dvh,26px)] font-normal"
      style={{
        background: disabled ? "transparent" : "var(--card)",
        border: disabled ? "1px dashed var(--line-2)" : "1px solid var(--line)",
        color: disabled ? "var(--muted-2)" : "var(--ink)",
        boxShadow: disabled ? "none" : "0 1px 2px rgba(28,24,20,0.05)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
      {sub && <span className="mt-px font-sans text-[8.5px] font-semibold tracking-[1.3px] text-muted">{sub}</span>}
    </button>
  );
}

function PinNumpad({ onDigit, onBack, onSubmit, canSubmit, disabled }: { onDigit: (d: string) => void; onBack: () => void; onSubmit: () => void; canSubmit: boolean; disabled: boolean }) {
  return (
    <div className="grid justify-center gap-[clamp(8px,1.4dvh,12px)]" style={{ gridTemplateColumns: "repeat(3, var(--key))" }}>
      {KEYS.map(([d, sub]) => (
        <PadKey key={d} onTap={() => onDigit(d)} sub={sub} disabled={disabled}>
          {d}
        </PadKey>
      ))}
      <button
        type="button"
        onClick={() => canSubmit && onSubmit()}
        disabled={!canSubmit}
        className="tap h-[var(--key)] w-[var(--key)] rounded-full text-[15px] font-bold tracking-[0.5px]"
        style={{
          background: canSubmit ? "var(--ink)" : "transparent",
          color: canSubmit ? "var(--paper)" : "var(--muted-2)",
          border: canSubmit ? "1px solid var(--ink)" : "1px dashed var(--line-2)",
          cursor: canSubmit ? "pointer" : "default",
        }}
      >
        OK
      </button>
      <PadKey onTap={() => onDigit("0")} disabled={disabled}>
        0
      </PadKey>
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        aria-label="Backspace"
        className="tap flex h-[var(--key)] w-[var(--key)] items-center justify-center rounded-full bg-transparent"
        style={{ color: disabled ? "var(--muted-2)" : "var(--ink-2)", cursor: disabled ? "default" : "pointer" }}
      >
        <svg width="24" height="20" viewBox="0 0 28 22" fill="none">
          <path d="M9 1L1 11l8 10h17a2 2 0 002-2V3a2 2 0 00-2-2H9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 7l7 8M21 7l-7 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function PinLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  const now = useNow();
  const staffQ = useStaffList();
  const staff = staffQ.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const selected = staff.find((s) => s.id === selectedId);
  const throttled = wait > 0;

  function select(id: string) {
    setSelectedId(id);
    setEntered("");
    setError(null);
  }
  function digit(d: string) {
    if (!selectedId || throttled || busy || entered.length >= 6) return;
    if (error) setError(null);
    setEntered((e) => e + d);
  }
  function back() {
    if (error) {
      setError(null);
      setEntered("");
      return;
    }
    setEntered((e) => e.slice(0, -1));
  }
  async function submit() {
    if (!selected || entered.length < 4) return;
    setBusy(true);
    try {
      await request<{ staff: SessionStaff }>("/api/session/login", { method: "POST", body: JSON.stringify({ id: selected.id, pin: entered }) });
      qc.clear();
      router.replace("/sell");
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 429) {
        setWait(err.retryAfter ?? LOGIN_WINDOW_S);
        setEntered("");
        return;
      }
      const wrongPin = err instanceof ApiError && (err.status === 401 || err.status === 400 || err.status === 403);
      setError(wrongPin ? "Incorrect PIN · try again" : errorText(err));
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      setTimeout(() => setEntered(""), 600);
    }
  }

  const dateLine = now
    ? `${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} · ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : " ";

  let status: ReactNode;
  if (throttled) status = <>Too many attempts from this tablet · try again in <span className="mono">{Math.floor(wait / 60)}:{String(wait % 60).padStart(2, "0")}</span></>;
  else if (error) status = <>{error}</>;
  else if (busy) status = <>Signing in…</>;
  else if (!selectedId) status = <span className="font-medium text-muted-2">Select your name to begin</span>;

  return (
    <div className="scroll relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-paper px-4 py-4 sm:px-6" style={{ ["--key" as string]: "clamp(58px, 9.5dvh, 76px)" }} data-screen-label="PIN Login">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-1 opacity-55" style={{ background: "linear-gradient(90deg, var(--matcha), var(--yuzu), var(--persimmon))" }} />
      {/* One column normally; on landscape phones the keypad moves beside the staff picker. The two groups are display:contents otherwise. */}
      <div className="rise my-auto flex w-full max-w-[760px] flex-col items-center gap-[clamp(6px,1.4dvh,12px)] short-land:flex-row short-land:gap-8">
        <div className="contents short-land:flex short-land:min-w-0 short-land:flex-1 short-land:flex-col short-land:items-center short-land:gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="serif-i text-[36px] leading-none tracking-[-0.8px] text-ink">Ippuku</div>
            <div className="whitespace-nowrap text-[10.5px] font-semibold tracking-[3px] text-muted">一服 · COFFEE · TEA</div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-medium text-ink-2">{selected ? `Hello, ${firstName(selected.name)}` : "Who's working?"}</div>
            <div className="mt-[3px] text-[11.5px] text-muted">{selected ? "Enter your PIN (4–6 digits), then OK" : dateLine}</div>
          </div>

          <div className="min-h-[106px] w-full self-stretch">
            {staffQ.isPending && <div className="pt-9 text-center text-[12.5px] text-muted">Loading staff…</div>}
            {staffQ.isError && (
              <div className="flex flex-col items-center gap-2 pt-5 text-center">
                <div className="text-[13px] font-semibold text-persimmon-2">Couldn&apos;t load the staff list</div>
                <div className="text-[12px] text-muted">{errorText(staffQ.error)}</div>
                <Btn size="sm" onClick={() => staffQ.refetch()}>Retry</Btn>
              </div>
            )}
            {staffQ.isSuccess && staff.length === 0 && <div className="pt-9 text-center text-[12.5px] text-muted">No active staff. Ask the owner to add someone.</div>}
            {staff.length > 0 && <StaffSelector staff={staff} selectedId={selectedId} onSelect={select} />}
          </div>

          <div className="min-h-[18px]">
            <PinDots length={Math.max(4, entered.length)} count={entered.length} error={!!error} shaking={shaking} />
          </div>
          <div className={`min-h-[18px] text-center text-[12.5px] font-semibold tracking-[0.2px] ${error || throttled ? "text-persimmon" : "text-muted"}`}>{status}</div>
        </div>
        <div className="contents short-land:flex short-land:shrink-0 short-land:flex-col short-land:items-center short-land:gap-2">
          <PinNumpad onDigit={digit} onBack={back} onSubmit={submit} canSubmit={entered.length >= 4 && !busy && !throttled} disabled={!selectedId || throttled} />
          <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-center text-[11px] text-muted">
            <span>Forgot PIN? Ask the owner to reset it.</span>
            <span className="text-muted-2">·</span>
            <span>Counter 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
