import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { ADMIN_COOKIE, adminCookiePlausible } from "@/server/admin/session";

const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);

export const proxy = clerkMiddleware((_auth, request) => {
  const { pathname } = request.nextUrl;

  if (isAdminRoute(request) && pathname !== "/admin/login") {
    // A shape check only. Sessions now live in `admin_session`, and deciding
    // whether a token names a live row needs the database — which this proxy
    // has no business opening a pool to on every request. The gate that counts
    // is `requireAdmin()` in the layout and in every action; this just spares
    // an anonymous visitor a render.
    if (!adminCookiePlausible(request.cookies.get(ADMIN_COOKIE)?.value)) {
      const login = new URL("/admin/login", request.url);
      if (pathname !== "/admin") login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/__clerk/:path*",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
