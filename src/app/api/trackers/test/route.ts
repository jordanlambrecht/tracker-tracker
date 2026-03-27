// src/app/api/trackers/test/route.ts
import { NextResponse } from "next/server"
import {
  buildFetchOptions,
  DEFAULT_API_PATHS,
  getAdapter,
  VALID_PLATFORM_TYPES,
} from "@/lib/adapters"
import { authenticate, parseJsonBody, validateHttpUrl } from "@/lib/api-helpers"
import { log } from "@/lib/logger"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { baseUrl, apiToken, platformType, apiPath } = body as {
    baseUrl?: string
    apiToken?: string
    platformType?: string
    apiPath?: string
  }

  if (!baseUrl || typeof baseUrl !== "string" || !apiToken || typeof apiToken !== "string") {
    return NextResponse.json({ error: "baseUrl and apiToken are required" }, { status: 400 })
  }

  const trimmedBaseUrl = baseUrl.trim()
  const trimmedApiToken = apiToken.trim()

  if (trimmedApiToken.length > 500) {
    return NextResponse.json(
      { error: "API token must be 500 characters or fewer" },
      { status: 400 }
    )
  }

  if (trimmedBaseUrl.length > 500) {
    return NextResponse.json({ error: "URL must be 500 characters or fewer" }, { status: 400 })
  }

  const urlErr = validateHttpUrl(trimmedBaseUrl)
  if (urlErr) return urlErr

  const platform = typeof platformType === "string" ? platformType : "unit3d"
  if (!VALID_PLATFORM_TYPES.includes(platform as (typeof VALID_PLATFORM_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid platform type" }, { status: 400 })
  }

  try {
    const adapter = getAdapter(platform)
    const defaultPath = DEFAULT_API_PATHS[platform] ?? "/api/user"
    const rawPath = typeof apiPath === "string" && apiPath.startsWith("/") ? apiPath : defaultPath
    const path = rawPath.length > 500 ? rawPath.slice(0, 500) : rawPath
    const fetchOptions = buildFetchOptions(trimmedBaseUrl)
    const stats = await adapter.fetchStats(trimmedBaseUrl, trimmedApiToken, path, fetchOptions)
    return NextResponse.json({
      success: true,
      username: stats.username,
      group: stats.group,
    })
  } catch (error) {
    log.warn(
      {
        route: "POST /api/trackers/test",
        error: String(error),
      },
      "tracker connection test failed"
    )
    return NextResponse.json({ error: "Tracker test failed" }, { status: 422 })
  }
}
