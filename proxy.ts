import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic page guard (cookie presence + cached role). The API still enforces auth on every call.
const TOKEN_COOKIE = "ipk_token";
const STAFF_COOKIE = "ipk_staff";

function roleOf(req: NextRequest): string | null {
  const raw = req.cookies.get(STAFF_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw).role ?? null;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = req.cookies.has(TOKEN_COOKIE);

  if (pathname === "/login") return NextResponse.next();
  if (!signedIn) return NextResponse.redirect(new URL("/login", req.url));
  if (pathname.startsWith("/backoffice") && roleOf(req) !== "OWNER") {
    return NextResponse.redirect(new URL("/sell", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API, build assets and public PWA files (sw.js, manifest, offline page, icons)
  matcher: ["/((?!api|_next/static|_next/image|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|js|webmanifest|html)$).*)"],
};
