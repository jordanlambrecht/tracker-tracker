// src/app/api/settings/flaresolverr-test/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import {
  authenticate,
  parseJsonBody,
  validateFlareSolverrUrl,
  validateMaxLength,
} from "@/lib/api-helpers"
import { LONG_STRING_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { solverReady } from "@/lib/tracker-platforms/helpers/flaresolverr"

const TEST_TIMEOUT_MS = 10_000

/** Checks the URL as typed, saved or not, so it can be tried before saving. */
export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { url: rawUrl } = body as { url?: unknown }
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }
  const url = rawUrl.trim().replace(/\/+$/, "")
  const lengthErr = validateMaxLength(url, LONG_STRING_MAX, "FlareSolverr URL")
  if (lengthErr) return lengthErr
  const urlErr = validateFlareSolverrUrl(url)
  if (urlErr) return urlErr

  try {
    const version = await solverReady(url, TEST_TIMEOUT_MS)
    return NextResponse.json({ success: true, version: version || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : "FlareSolverr test failed"
    log.warn(
      { route: "POST /api/settings/flaresolverr-test", error: message },
      "flaresolverr test failed"
    )
    return NextResponse.json({ success: false, error: message }, { status: 422 })
  }
}
