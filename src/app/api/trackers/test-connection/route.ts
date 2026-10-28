// src/app/api/trackers/test-connection/route.ts
import { NextResponse } from "next/server"
import { DEFAULT_API_PATHS, VALID_PLATFORM_TYPES } from "@/data/platform-types"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  validateHttpUrl,
  validateMaxLength,
} from "@/lib/api-helpers"
import { maxTokenLengthFor } from "@/lib/credential-forms"
import { stripTrailingSlash } from "@/lib/data-transforms"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { LONG_STRING_MAX, TRACKER_URL_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { buildFetchOptions, getAdapter } from "@/lib/tracker-platforms"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { slug, baseUrl, apiToken, platformType, apiPath } = body as {
    slug?: string
    baseUrl?: string
    apiToken?: string
    platformType?: string
    apiPath?: string
  }

  // A slug names the registry entry, and address, platform and API path all come
  // from it. Only a row without a slug sends baseUrl and platformType instead.
  const trimmedSlug = typeof slug === "string" ? slug.trim() : ""
  const entry = trimmedSlug ? getTrackerBySlug(trimmedSlug) : undefined
  if (trimmedSlug && !entry) {
    return NextResponse.json({ error: "Unknown tracker" }, { status: 400 })
  }

  const rawBaseUrl = entry?.url ?? (typeof baseUrl === "string" ? baseUrl : "")

  if (!rawBaseUrl.trim() || !apiToken || typeof apiToken !== "string") {
    return NextResponse.json(
      { error: "slug or baseUrl, and apiToken are required" },
      { status: 400 }
    )
  }

  // Adapters concatenate onto this as well as passing it to `new URL`, and the
  // first form doubles the separator. Registry URLs carry no trailing slash; a
  // stored URL from a row without a slug can.
  const trimmedBaseUrl = stripTrailingSlash(rawBaseUrl.trim())
  const trimmedApiToken = apiToken.trim()
  const platform = entry?.platform ?? (typeof platformType === "string" ? platformType : "unit3d")

  const maxTokenLength = maxTokenLengthFor(platform)
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
    const key = decodeKey(auth)
    const [settings] = await db
      .select({
        proxyEnabled: appSettings.proxyEnabled,
        proxyType: appSettings.proxyType,
        proxyHost: appSettings.proxyHost,
        proxyPort: appSettings.proxyPort,
        proxyUsername: appSettings.proxyUsername,
        encryptedProxyPassword: appSettings.encryptedProxyPassword,
      })
      .from(appSettings)
      .limit(1)

    const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

    const adapter = getAdapter(platform)
    const defaultPath = DEFAULT_API_PATHS[platform] ?? "/api/user"
    const bodyPath = typeof apiPath === "string" && apiPath.startsWith("/") ? apiPath : defaultPath
    const path = entry?.apiPath ?? bodyPath
    const pathLenErr = validateMaxLength(path, LONG_STRING_MAX, "API path")
    if (pathLenErr) return pathLenErr
    const fetchOptions = buildFetchOptions({
      registrySlug: entry?.slug,
      proxyAgent: proxyAgent ?? undefined,
    })
    const stats = await adapter.fetchStats(trimmedBaseUrl, trimmedApiToken, path, fetchOptions)

    const result: Record<string, unknown> = {
      success: true,
      username: stats.username,
      group: stats.group,
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
