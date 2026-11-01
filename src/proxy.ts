import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic redirect only: it checks that a session cookie exists, not that it is valid.
// The real check is requireCurrentUser() in the (app) layout.
export function proxy(request: NextRequest): NextResponse {
  if (getSessionCookie(request) != null) return NextResponse.next();

  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  matcher: [
    "/",
    "/radar/:path*",
    "/rankings/:path*",
    "/anuncios/:path*",
    "/creators/:path*",
    "/studio/:path*",
    "/configuracoes/:path*",
    "/admin/:path*",
  ],
};
