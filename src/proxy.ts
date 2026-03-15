// src/proxy.ts
import { type NextRequest, NextResponse } from "next/server"

const PUBLIC_EXACT = ["/login", "/setup", "/api/health"]
const PUBLIC_PREFIX = ["/api/auth/"]
const SESSION_COOKIE = "tt_session"
const MAX_AGE_COOKIE = "tt_max_age"
const MAX_COOKIE_AGE = 60 * 60 * 24 * 30 // 30-day hard cap

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Sliding window: re-set both cookies with a fresh maxAge on every
  // authenticated request. This extends the inactivity timeout without
  // needing to decrypt or re-create the JWE.
  const response = NextResponse.next()
  const maxAgeStr = request.cookies.get(MAX_AGE_COOKIE)?.value
  const maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : null

  if (maxAge && maxAge > 0 && maxAge <= MAX_COOKIE_AGE) {
    const isProduction = process.env.NODE_ENV === "production"
    response.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge,
      path: "/",
    })
    response.cookies.set(MAX_AGE_COOKIE, String(maxAge), {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge,
      path: "/",
    })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.png|tracker-logos|trackerHub_logo|trackerTracker_logo).*)",
  ],
}
