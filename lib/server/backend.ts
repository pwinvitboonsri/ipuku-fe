import "server-only";
import { createHmac } from "node:crypto";
import { headers as requestHeaders } from "next/headers";
import { UNREACHABLE_HEADER, WAKE_HEADER } from "@/lib/connectivity";

// Server-side access to the NestJS API. The browser never talks to NestJS directly:
// the JWT lives in an httpOnly cookie and HMAC_SECRET never leaves the server.

export const TOKEN_COOKIE = "ipk_token";
export const STAFF_COOKIE = "ipk_staff";
export const SESSION_MAX_AGE = 60 * 60 * 24; // matches JWT_EXPIRES_IN (1 day)

const UPSTREAM_TIMEOUT_MS = 10_000;

function baseUrl() {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error("API_BASE_URL is not set — fill it in your .env.* file");
  return url.replace(/\/+$/, "");
}

// GET /v1/auth is device-signed: x-signature = HMAC-SHA256("<timestamp>.<METHOD>.<url>")
// where url is the request path + query as the server sees it (e.g. "/v1/auth").
function deviceSignature(method: string, pathAndQuery: string) {
  const secret = process.env.HMAC_SECRET;
  if (!secret) throw new Error("HMAC_SECRET is not set — fill it in your .env.* file");
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", secret).update(`${timestamp}.${method}.${pathAndQuery}`).digest("hex");
  return { "x-timestamp": timestamp, "x-signature": signature };
}

const SIGNED_ROUTES = new Set(["GET /v1/auth"]);

// Marks a response as "API unreachable" and says where the browser can wake it.
// Render's free plan sleeps when idle, and requests from this Worker get an instant 502 without
// waking it — but an ordinary request straight from the tablet does. The URL is the public API host.
function unreachable() {
  return { [UNREACHABLE_HEADER]: "1", [WAKE_HEADER]: `${baseUrl()}/health` };
}

// Every call reaches NestJS from this server, so the API would rate-limit the whole shop as one IP.
// Pass the tablet's IP along, with BFF_KEY proving it came from us. cf-connecting-ip is set by
// Cloudflare and can't be spoofed by the client; locally there is none and nothing is sent.
async function clientIpHeaders(): Promise<Record<string, string>> {
  const key = process.env.BFF_KEY;
  if (!key) return {};
  const ip = (await requestHeaders()).get("cf-connecting-ip");
  return ip ? { "x-client-ip": ip, "x-bff-key": key } : {};
}

export async function callBackend(
  method: string,
  pathAndQuery: string,
  { token, body }: { token?: string; body?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  Object.assign(headers, await clientIpHeaders());
  let url: string;
  try {
    url = baseUrl() + pathAndQuery;
    const path = pathAndQuery.split("?")[0];
    if (SIGNED_ROUTES.has(`${method} ${path}`)) Object.assign(headers, deviceSignature(method, pathAndQuery));
  } catch (err) {
    // Missing env config — surface it to the UI instead of an HTML error page.
    const message = err instanceof Error ? err.message : "Server misconfigured";
    console.error(`[api] ${message}`);
    return Response.json({ statusCode: 500, error: "Server misconfigured", message }, { status: 500 });
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    // Render answers with its own HTML 502/503 page while the API sleeps, wakes or restarts.
    // That isn't NestJS speaking: report it as unreachable so the app shows the offline banner
    // and polls /health, instead of printing the HTML as an error message.
    if (res.status >= 502 && res.status <= 504 && !res.headers.get("content-type")?.includes("application/json")) {
      console.warn(`[api] ${method} ${pathAndQuery} → upstream ${res.status} (not JSON): API asleep, starting or down`);
      return Response.json(
        { statusCode: res.status, error: "Server unavailable", message: "The server is starting up — try again in a minute" },
        { status: res.status, headers: unreachable() },
      );
    }
    return res;
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return Response.json(
      {
        statusCode: timedOut ? 504 : 502,
        error: timedOut ? "Gateway Timeout" : "Bad Gateway",
        message: timedOut ? "The server took too long to respond" : "Can't reach the server",
      },
      { status: timedOut ? 504 : 502, headers: unreachable() },
    );
  }
}

// Copy an upstream response to the browser, keeping only the headers the UI needs.
export async function relay(upstream: Response): Promise<Response> {
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);
  if (upstream.headers.get(UNREACHABLE_HEADER)) headers.set(UNREACHABLE_HEADER, "1");
  const wake = upstream.headers.get(WAKE_HEADER);
  if (wake) headers.set(WAKE_HEADER, wake);
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
