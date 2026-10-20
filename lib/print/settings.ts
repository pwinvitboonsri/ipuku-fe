"use client";

import { localStore } from "./local-store";
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
  printer: string; // RawBT printer name; "" = whichever printer is ticked in RawBT (via the link)
  mode: RawbtMode; // link form, used only when printer is ""
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
  printer: "",
  mode: "intent",
  header: "",
  footer: "THANK YOU\nENJOY YOUR DAY ♡",
  logo: null,
  bottom: null,
};

const store = localStore("ipk_printer_v1", DEFAULT_PRINTER);
export const savePrinterSettings = store.save;
export const usePrinterSettings = store.use;

export const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
