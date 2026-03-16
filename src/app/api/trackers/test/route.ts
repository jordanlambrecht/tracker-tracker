// src/app/api/trackers/test/route.ts
import { NextResponse } from "next/server"
import { findRegistryEntry } from "@/data/tracker-registry"
import { DEFAULT_API_PATHS, getAdapter, VALID_PLATFORM_TYPES } from "@/lib/adapters"
import { authenticate, parseJsonBody, validateHttpUrl } from "@/lib/api-helpers"

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

  if (apiToken.length > 500) {
    return NextResponse.json(
      { error: "API token must be 500 characters or fewer" },
      { status: 400 }
    )
  }

  if (baseUrl.length > 500) {
    return NextResponse.json({ error: "URL must be 500 characters or fewer" }, { status: 400 })
  }

  const urlErr = validateHttpUrl(baseUrl)
  if (urlErr) return urlErr

  const platform = typeof platformType === "string" ? platformType : "unit3d"
  if (!VALID_PLATFORM_TYPES.includes(platform as (typeof VALID_PLATFORM_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid platform type" }, { status: 400 })
  }

  try {
    const adapter = getAdapter(platform)
    const defaultPath = DEFAULT_API_PATHS[platform] ?? "/api/user"
    const path = typeof apiPath === "string" && apiPath.startsWith("/") ? apiPath : defaultPath
    const registryEntry = findRegistryEntry(baseUrl)
    const fetchOptions: { authStyle?: "token" | "raw"; enrich?: boolean } = {}
    if (registryEntry?.gazelleAuthStyle) fetchOptions.authStyle = registryEntry.gazelleAuthStyle
    if (registryEntry?.gazelleEnrich) fetchOptions.enrich = true
    const stats = await adapter.fetchStats(baseUrl, apiToken, path, fetchOptions)
    return NextResponse.json({
      success: true,
      username: stats.username,
      group: stats.group,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed"
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
