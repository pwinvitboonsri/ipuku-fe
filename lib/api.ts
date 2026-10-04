// Browser API client. Every call goes through the Next backend-for-frontend (/api/v1/*),
// which attaches the session token and forwards to NestJS /v1/*.

import { UNREACHABLE_HEADER, connectivity } from "./connectivity";

export class ApiError extends Error {
  status: number;
  messages: string[];
  code?: string;
  retryAfter?: number;

  constructor(status: number, messages: string[], code?: string, retryAfter?: number) {
    super(messages[0] ?? `Request failed (${status})`);
    this.status = status;
    this.messages = messages;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export const UNAUTHORIZED_EVENT = "ipk:unauthorized";

// `raw` is the whole response body, for routes that return extra top-level fields (e.g. recipe `modifiers`)
export type Envelope<T> = { data: T; meta?: Record<string, unknown>; raw?: unknown };
type Query = Record<string, string | number | boolean | null | undefined>;

function toQuery(q?: Query) {
  if (!q) return "";
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function errorFrom(res: Response, body: unknown): ApiError {
  const b = (body ?? {}) as { message?: unknown; code?: string };
  const messages = Array.isArray(b.message)
    ? b.message.map(String)
    : typeof b.message === "string"
      ? [b.message]
      : [res.statusText || `Request failed (${res.status})`];
  const ra = Number(res.headers.get("retry-after"));
  return new ApiError(res.status, messages, b.code, Number.isFinite(ra) && ra > 0 ? ra : undefined);
}

export async function request<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  } catch {
    connectivity.markOffline();
    throw new ApiError(0, ["Can't reach the server"]);
  }
  if (res.headers.get(UNREACHABLE_HEADER)) connectivity.markOffline();
  else connectivity.markOnline();
  const body = await parse(res);
  if (!res.ok) {
    // Token expired or revoked — the app shell listens for this and signs out.
    if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw errorFrom(res, body);
  }
  // Most routes wrap in { success, data, meta }; auth routes return the object directly.
  if (body && typeof body === "object" && "success" in body) {
    return { data: (body as { data: T }).data, meta: (body as { meta?: Record<string, unknown> }).meta, raw: body };
  }
  return { data: body as T };
}

export const api = {
  list: <T>(path: string, q?: Query) => request<T>(`/api/v1${path}${toQuery(q)}`),
  get: async <T>(path: string, q?: Query) => (await request<T>(`/api/v1${path}${toQuery(q)}`)).data,
  post: async <T>(path: string, body?: unknown) =>
    (await request<T>(`/api/v1${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })).data,
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.messages.join(" · ");
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
