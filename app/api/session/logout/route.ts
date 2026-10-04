import { cookies } from "next/headers";
import { STAFF_COOKIE, TOKEN_COOKIE } from "@/lib/server/backend";

export async function POST() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(STAFF_COOKIE);
  return Response.json({ ok: true });
}
