// RawBT's local WebSocket server on the tablet. Unlike the rawbt: link (always the printer
// ticked in RawBT), a job sent here names its printer, so one tablet can drive several.
// Protocol from github.com/402d/RawbtAPI (alpha): "GET_PRINTERS" → {responseType:"printers", printers},
// a job JSON → {responseType:"success"|"error"|"canceled"|"progress", jobId, errorMessage}.
import { toBase64 } from "./escpos";

export const RAWBT_WS_URL = "ws://localhost:40213/";

export type RawbtPrinter = { name: string; description?: string };

type RawbtReply = {
  responseType?: string;
  jobId?: string;
  errorMessage?: string;
  progress?: number;
  printers?: RawbtPrinter[];
};

// Opens a socket, runs one exchange, closes. `onRaw` sees every frame (for the test page).
function exchange<T>(send: string, pick: (r: RawbtReply) => T | undefined, onRaw?: (msg: string) => void, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(RAWBT_WS_URL);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ws.close();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("RawBT didn't answer in time"))), timeoutMs);
    ws.onopen = () => ws.send(send);
    ws.onerror = () => finish(() => reject(new Error("Can't reach RawBT on this tablet (ws://localhost:40213)")));
    ws.onclose = () => finish(() => reject(new Error("RawBT closed the connection")));
    ws.onmessage = (e) => {
      const text = String(e.data);
      onRaw?.(text);
      let reply: RawbtReply;
      try {
        reply = JSON.parse(text);
      } catch {
        return;
      }
      if (reply.responseType === "error") return finish(() => reject(new Error(reply.errorMessage || "RawBT reported an error")));
      if (reply.responseType === "canceled") return finish(() => reject(new Error("Print canceled")));
      const value = pick(reply);
      if (value !== undefined) finish(() => resolve(value));
    };
  });
}

export function listRawbtPrinters(onRaw?: (msg: string) => void): Promise<RawbtPrinter[]> {
  return exchange("GET_PRINTERS", (r) => (r.responseType === "printers" ? (r.printers ?? []) : undefined), onRaw);
}

// Sends raw printer bytes (ESC/POS, TSPL, …) to the named RawBT printer.
export function printOnRawbt(printer: string, bytes: Uint8Array, onRaw?: (msg: string) => void): Promise<void> {
  const idJob = `ipk-${Date.now().toString(36)}`;
  const job = { idJob, printer, template: "none", copies: 1, commands: [{ command: "sendBytes", base64: toBase64(bytes) }] };
  return exchange(JSON.stringify(job), (r) => (r.responseType === "success" && (!r.jobId || r.jobId === idJob) ? true : undefined), onRaw, 30_000).then(() => undefined);
}
