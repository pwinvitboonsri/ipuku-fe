import { callBackend, relay } from "@/lib/server/backend";

// GET /health (unversioned) — drives the "can't reach the server" banner.
export async function GET() {
  return relay(await callBackend("GET", "/health"));
}
