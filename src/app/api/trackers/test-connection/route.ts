// src/app/api/trackers/test-connection/route.ts
import { NextResponse } from "next/server"
import { trackerSiteFor } from "@/data/tracker-registry"
import { authenticate, decodeKey, parseJsonBody, validateMaxLength } from "@/lib/api-helpers"
import { maxTokenLengthFor } from "@/lib/credential-forms"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { buildFetchOptions, getAdapter } from "@/lib/tracker-platforms"
import { TRACKER_DEFUNCT_ERROR, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { slug, apiToken } = body as { slug?: string; apiToken?: string }

  // The slug's registry entry settles address, platform and API path, so nothing
  // else in the body can choose where the token goes.
  const site = trackerSiteFor({ registrySlug: typeof slug === "string" ? slug.trim() : null })
  if (!site) {
    return NextResponse.json({ error: TRACKER_UNLINKED_ERROR }, { status: 400 })
  }
  if (site.entry.defunct) {
    return NextResponse.json({ error: TRACKER_DEFUNCT_ERROR }, { status: 400 })
  }

  if (!apiToken || typeof apiToken !== "string") {
    return NextResponse.json({ error: "apiToken is required" }, { status: 400 })
  }

  const trimmedApiToken = apiToken.trim()
  const tokenErr = validateMaxLength(trimmedApiToken, maxTokenLengthFor(site.platform), "API token")
  if (tokenErr) return tokenErr

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

    const adapter = getAdapter(site.platform)
    const fetchOptions = buildFetchOptions({
      entry: site.entry,
      proxyAgent: proxyAgent ?? undefined,
    })
    const stats = await adapter.fetchStats(site.url, trimmedApiToken, site.apiPath, fetchOptions)

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
        platform: site.platform,
        baseUrl: site.url,
        error: raw,
      },
      `tracker test failed: ${safeError}`
    )
    return NextResponse.json({ error: safeError }, { status: 422 })
  }
}
