import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { callBackend, cookieOptions, relay, STAFF_COOKIE, TOKEN_COOKIE } from "@/lib/server/backend";

// POST { id, pin } → NestJS /v1/auth/login → { access_token, staff }.
// The token goes into an httpOnly cookie; the browser only gets the staff profile.
export async function POST(req: NextRequest) {
  const upstream = await callBackend("POST", "/v1/auth/login", { body: await req.text() });
  if (!upstream.ok) return relay(upstream);

  const data = await upstream.json();
  const token: string | undefined = data?.access_token ?? data?.data?.access_token;
  const raw = data?.staff ?? data?.data?.staff;
  if (!token || !raw) {
    return Response.json({ statusCode: 502, error: "Bad Gateway", message: "Unexpected login response" }, { status: 502 });
  }

  const staff = { id: String(raw.id), name: String(raw.name), role: raw.role === "OWNER" ? "OWNER" : "STAFF" };
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, cookieOptions);
  jar.set(STAFF_COOKIE, JSON.stringify(staff), cookieOptions);
  return Response.json({ staff });
}
