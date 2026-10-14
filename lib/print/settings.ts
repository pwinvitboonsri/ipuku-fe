"use client";

import { useSyncExternalStore } from "react";
import type { PaperWidth } from "./escpos";
import type { RawbtMode } from "./rawbt";

// A receipt picture: the R2 copy (the original, kept off the tablet) plus a small
// print-ready copy inlined here so printing never waits on the network.
export type PrintImage = { url: string; data: string };

// Per-tablet printer setup. It lives in this browser only: each counter device has its own printer.
export type PrinterSettings = {
  enabled: boolean; // show print buttons at all
  auto: boolean; // print as soon as a payment succeeds
  ticket: boolean; // short slip for the bar
  receipt: boolean; // customer receipt
  paper: PaperWidth;
  cut: boolean;
  mode: RawbtMode;
  header: string; // lines under the shop name (branch, address, phone, tax ID), one per line
  footer: string; // closing lines, one per line
  logo: PrintImage | null;
  bottom: PrintImage | null; // picture under the footer
};

export const DEFAULT_PRINTER: PrinterSettings = {
  enabled: true,
  auto: true,
  ticket: true,
  receipt: true,
  paper: 80,
  cut: true,
  mode: "intent",
  header: "",
  footer: "THANK YOU\nENJOY YOUR DAY ♡",
  logo: null,
  bottom: null,
};

const KEY = "ipk_printer_v1";
const listeners = new Set<() => void>();
let cached: PrinterSettings | null = null;

function read(): PrinterSettings {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? { ...DEFAULT_PRINTER, ...JSON.parse(raw) } : DEFAULT_PRINTER;
  } catch {
    cached = DEFAULT_PRINTER;
  }
  return cached!;
}

export function savePrinterSettings(patch: Partial<PrinterSettings>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // private mode / storage full: keep the settings for this session only
  }
  listeners.forEach((l) => l());
}

export function usePrinterSettings(): PrinterSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_PRINTER,
  );
}

export const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
