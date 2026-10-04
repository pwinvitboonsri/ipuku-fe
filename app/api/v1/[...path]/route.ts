import type { NextRequest } from "next/server";
import { callBackend, relay, TOKEN_COOKIE } from "@/lib/server/backend";

// Backend-for-frontend: /api/v1/* → NestJS /v1/*, with the Bearer token taken from the httpOnly cookie.
// Login goes through /api/session/login instead so the token is never exposed to the browser.

async function forward(req: NextRequest, ctx: RouteContext<"/api/v1/[...path]">) {
  const { path } = await ctx.params;
  const target = `/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  if (target.startsWith("/v1/auth/login")) {
    return Response.json({ statusCode: 404, error: "Not Found", message: "Use /api/session/login" }, { status: 404 });
  }
  const body = req.method === "GET" ? undefined : await req.text();
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  return relay(await callBackend(req.method, target, { token, body: body || undefined }));
}

export const GET = forward;
export const POST = forward;
