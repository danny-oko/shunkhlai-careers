import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE, verifyAdminSession } from "@/server/admin/session";

/**
 * Keeps `/admin` from rendering for someone who is not signed in.
 *
 * This is a redirect, not the authorisation. A proxy is documented to run
 * ahead of — and potentially outside — the application, so it is the wrong
 * place to be the only check: `requireAdmin()` in the admin layout and at the
 * top of every mutating action is what actually refuses. What this buys is
 * that an unauthenticated request never reaches a render at all, so the admin
 * screens are not one missing guard away from being public.
 *
 * `middleware.ts` is deprecated in Next 16 in favour of this file, and proxy
 * defaults to the Node.js runtime here, which is why `node:crypto` inside
 * `verifyAdminSession` is available.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // The login screen is the one page behind /admin that must stay reachable,
  // or there is no way to obtain the cookie this function requires.
  if (pathname === "/admin/login") return NextResponse.next();

  if (verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const login = new URL("/admin/login", request.url);
  // Where they were headed, so the login form can hand them back afterwards.
  if (pathname !== "/admin") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
