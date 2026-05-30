import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/constants";
import { verifyToken } from "@/lib/jwt";

/**
 * Route protection middleware.
 *
 * - Unauthenticated users hitting a protected route are redirected to /login.
 * - Authenticated users hitting /login are redirected to /dashboard.
 *
 * Runs on the Edge runtime, so it only uses the edge-safe `verifyToken`.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifyToken(token);
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith("/dashboard");
  const isLoginPage = pathname === "/login";

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

/** Only run middleware on the routes that need it. */
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
