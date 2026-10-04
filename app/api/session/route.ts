import { cookies } from "next/headers";
import { STAFF_COOKIE, TOKEN_COOKIE } from "@/lib/server/backend";

// GET → the signed-in staff (from the session cookie), or 401.
export async function GET() {
  const jar = await cookies();
  const raw = jar.get(STAFF_COOKIE)?.value;
  if (!jar.get(TOKEN_COOKIE) || !raw) {
    return Response.json({ statusCode: 401, error: "Unauthorized", message: "Not signed in" }, { status: 401 });
  }
  try {
    return Response.json({ staff: JSON.parse(raw) });
  } catch {
    return Response.json({ statusCode: 401, error: "Unauthorized", message: "Not signed in" }, { status: 401 });
  }
}
