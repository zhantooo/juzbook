import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/security/session";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedReaderRoutes = pathname.startsWith("/books") || pathname.startsWith("/profile");
  const protectedAdminRoutes = pathname.startsWith("/admin");

  if (!protectedReaderRoutes && !protectedAdminRoutes) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(request);
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return redirectToLogin(request);
  }

  if (pathname.startsWith("/admin/users") && payload.role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (protectedAdminRoutes && !["ADMIN", "SUPERADMIN"].includes(payload.role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/books/:path*"]
};
