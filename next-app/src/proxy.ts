import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/s/", "/sm/"];
const EXACT_PUBLIC_PATHS = ["/", "/privacy", "/terms"];

/**
 * Lightweight proxy — checks for the NextAuth session cookie
 * without importing the full auth config (which would pull crypto/DB
 * into Edge Runtime).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    EXACT_PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie (JWT strategy)
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes should handle auth themselves)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     */
    "/((?!api|_next|favicon\\.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.webp$|.*\\.ico$).*)",
  ],
};
