import "server-only";
import { createHmac } from "node:crypto";
import { UNREACHABLE_HEADER } from "@/lib/connectivity";

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

export async function callBackend(
  method: string,
  pathAndQuery: string,
  { token, body }: { token?: string; body?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
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
    return await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return Response.json(
      {
        statusCode: timedOut ? 504 : 502,
        error: timedOut ? "Gateway Timeout" : "Bad Gateway",
        message: timedOut ? "The server took too long to respond" : "Can't reach the server",
      },
      { status: timedOut ? 504 : 502, headers: { [UNREACHABLE_HEADER]: "1" } },
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
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
