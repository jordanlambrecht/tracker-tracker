// src/app/api/trackers/test-connection/route.ts
import { NextResponse } from "next/server"
import {
  buildFetchOptions,
  DEFAULT_API_PATHS,
  getAdapter,
  VALID_PLATFORM_TYPES,
} from "@/lib/adapters"
import { authenticate, parseJsonBody, validateHttpUrl, validateMaxLength } from "@/lib/api-helpers"
import { sanitizeNetworkError } from "@/lib/error-utils"
import {
  AVISTAZ_TOKEN_MAX,
  LONG_STRING_MAX,
  TRACKER_TOKEN_MAX,
  TRACKER_URL_MAX,
} from "@/lib/limits"
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
  const platform = typeof platformType === "string" ? platformType : "unit3d"

  const maxTokenLength = platform === "avistaz" ? AVISTAZ_TOKEN_MAX : TRACKER_TOKEN_MAX
  const tokenErr = validateMaxLength(trimmedApiToken, maxTokenLength, "API token")
  if (tokenErr) return tokenErr

  const urlLenErr = validateMaxLength(trimmedBaseUrl, TRACKER_URL_MAX, "URL")
  if (urlLenErr) return urlLenErr

  const urlErr = validateHttpUrl(trimmedBaseUrl)
  if (urlErr) return urlErr

  if (!VALID_PLATFORM_TYPES.includes(platform as (typeof VALID_PLATFORM_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid platform type" }, { status: 400 })
  }

  try {
    const adapter = getAdapter(platform)
    const defaultPath = DEFAULT_API_PATHS[platform] ?? "/api/user"
    const rawPath = typeof apiPath === "string" && apiPath.startsWith("/") ? apiPath : defaultPath
    const pathLenErr = validateMaxLength(rawPath, LONG_STRING_MAX, "API path")
    if (pathLenErr) return pathLenErr
    const path = rawPath
    const fetchOptions = buildFetchOptions(trimmedBaseUrl)
    const stats = await adapter.fetchStats(trimmedBaseUrl, trimmedApiToken, path, fetchOptions)

    const result: Record<string, unknown> = {
      success: true,
      username: stats.username,
      group: stats.group,
    }

    if (platform === "avistaz") {
      log.debug(
        {
          route: "POST /api/trackers/test-connection",
          userAgent: request.headers.get("user-agent") ?? "",
        },
        "tracker test user agent captured"
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const safeError = sanitizeNetworkError(raw, "Tracker test failed")
    log.warn(
      {
        route: "POST /api/trackers/test-connection",
        platform,
        baseUrl: trimmedBaseUrl,
        error: raw,
      },
      `tracker test failed: ${safeError}`
    )
    return NextResponse.json({ error: safeError }, { status: 422 })
  }
}
