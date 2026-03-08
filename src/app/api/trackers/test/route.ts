// src/app/api/trackers/test/route.ts
import { NextResponse } from "next/server"
import { getAdapter } from "@/lib/adapters"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { baseUrl, apiToken, platformType } = body as {
    baseUrl?: string
    apiToken?: string
    platformType?: string
  }

  if (!baseUrl || typeof baseUrl !== "string" || !apiToken || typeof apiToken !== "string") {
    return NextResponse.json({ error: "baseUrl and apiToken are required" }, { status: 400 })
  }

  const platform = typeof platformType === "string" ? platformType : "unit3d"

  try {
    const adapter = getAdapter(platform)
    const stats = await adapter.fetchStats(baseUrl, apiToken, "/api/user")
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
