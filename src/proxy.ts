import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { ADMIN_COOKIE, verifyAdminSession } from "@/server/admin/session";

const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);

export const proxy = clerkMiddleware((_auth, request) => {
  const { pathname } = request.nextUrl;

  if (isAdminRoute(request) && pathname !== "/admin/login") {
    if (!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
      const login = new URL("/admin/login", request.url);
      if (pathname !== "/admin") login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
