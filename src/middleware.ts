import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Route protection middleware (Edge runtime).
 *
 * Uses an Auth.js instance built from the edge-safe `authConfig` only — it
 * reads the JWT session but never touches the database or bcrypt.
 *
 * Rules:
 *  - Public routes: "/" , "/login", "/register".
 *  - Logged-in users on /login or /register → /dashboard.
 *  - Unauthenticated users on any other route → /login.
 *  - Non-admins on /admin/* → /dashboard.
 */
const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = new Set(["/"]);
const AUTH_ROUTES = new Set(["/login", "/register"]);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = Boolean(req.auth);
  const role = req.auth?.user?.role;

  // Already authenticated → keep users off the marketing landing and the auth
  // pages, sending them to the app instead. Handling this here (rather than in
  // the page) lets "/" , "/login" and "/register" stay statically prerendered.
  // Onboarding-incomplete users are funneled on by the dashboard's own guard.
  if (AUTH_ROUTES.has(path) || PUBLIC_ROUTES.has(path)) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Everything else requires authentication.
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Admin area requires the admin role.
  if (path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, the auth API, and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|.*\\.).*)",
  ],
};
