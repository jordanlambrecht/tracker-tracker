// src/app/api/auth/username/route.ts
//
// Fills in a login username for an install that never had one, from the
// post-login prompt. Not a general username editor — see PATCH /api/settings
// for that; this endpoint only ever turns NULL into a value.
//
// ⚠ SECURITY: "/api/auth/" is a PUBLIC_PREFIX in src/proxy.ts, so the proxy
// returns NextResponse.next() for this path before it looks at any session
// cookie. The `authenticate()` call below is therefore the ONLY thing standing
// between an anonymous caller and claiming the login username of this instance.
// It must stay the first statement in the handler. Two guards keep it honest:
// checkAuthEnforcement() in scripts/security-audit.ts walks every route.ts under
// src/app/api and fails CI (severity: critical) for a handler that is not in
// NO_AUTH_ROUTES and calls none of authenticate/getSession/requireAuth, and
// "rejects an unauthenticated caller" in the tests next to this file asserts the
// 401 directly.
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { validateUsername } from "@/lib/limits"
import { log } from "@/lib/logger"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  // Same rules as initial setup, from the same function — a username accepted
  // here has to be one the login form could have been given at account creation.
  const check = validateUsername(body.username)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 })
  }

  const [settings] = await db
    .select({ id: appSettings.id, username: appSettings.username })
    .from(appSettings)
    .limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  // Narrow on purpose. This route exists to answer the first-login prompt, which
  // only appears while the column is NULL. Letting it overwrite an existing
  // username would make it a second, less careful write path for a credential
  // that already has one, and a stale prompt left open in another tab could
  // silently rename the account out from under the tab that just set it.
  if (settings.username) {
    return NextResponse.json(
      { error: "A username is already set. Change it in Settings › Account." },
      { status: 409 }
    )
  }

  await db
    .update(appSettings)
    .set({ username: check.username })
    .where(eq(appSettings.id, settings.id))

  log.info({ route: "POST /api/auth/username" }, "login username set from first-login prompt")

  // Echoed back so the client can show the exact stored value: this is now
  // required at the next sign-in, and the user should see what to type.
  return NextResponse.json({ success: true, username: check.username })
}
