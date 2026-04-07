// src/app/api/trackers/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { DEFAULT_API_PATHS, VALID_PLATFORM_TYPES } from "@/lib/adapters"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  validateHexColor,
  validateHttpUrl,
  validateJoinedAt,
  validateMaxLength,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import {
  AVISTAZ_TOKEN_MAX,
  LONG_STRING_MAX,
  TRACKER_NAME_MAX,
  TRACKER_TAG_MAX,
  TRACKER_TOKEN_MAX,
  TRACKER_URL_MAX,
} from "@/lib/limits"
import { log } from "@/lib/logger"
import { getTrackerListForDashboard } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const trackerList = await getTrackerListForDashboard()
    return NextResponse.json(trackerList)
  } catch (err) {
    log.error({ route: "GET /api/trackers", error: errMsg(err) }, "Failed to fetch trackers")
    return NextResponse.json({ error: "Failed to load trackers" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { name, baseUrl, apiToken, platformType, color, qbtTag, mouseholeUrl, joinedAt } = body as {
    name?: string
    baseUrl?: string
    apiToken?: string
    platformType?: string
    color?: string
    qbtTag?: string
    mouseholeUrl?: string
    joinedAt?: string
  }

  if (
    typeof name !== "string" ||
    typeof baseUrl !== "string" ||
    typeof apiToken !== "string" ||
    !name.trim() ||
    !baseUrl.trim() ||
    !apiToken.trim()
  ) {
    return NextResponse.json(
      { error: "name, baseUrl, and apiToken are required strings" },
      { status: 400 }
    )
  }

  const trimmedName = name.trim()
  const trimmedBaseUrl = baseUrl.trim()
  const trimmedApiToken = apiToken.trim()
  const platform = typeof platformType === "string" ? platformType : "unit3d"

  const nameErr = validateMaxLength(trimmedName, TRACKER_NAME_MAX, "Name")
  if (nameErr) return nameErr

  const urlLenErr = validateMaxLength(trimmedBaseUrl, TRACKER_URL_MAX, "URL")
  if (urlLenErr) return urlLenErr

  const maxTokenLength = platform === "avistaz" ? AVISTAZ_TOKEN_MAX : TRACKER_TOKEN_MAX
  const tokenErr = validateMaxLength(trimmedApiToken, maxTokenLength, "API token")
  if (tokenErr) return tokenErr

  const urlErr = validateHttpUrl(trimmedBaseUrl)
  if (urlErr) return urlErr

  if (typeof color === "string") {
    const colorErr = validateHexColor(color)
    if (colorErr) return colorErr
  }

  if (typeof qbtTag === "string") {
    const qbtTagErr = validateMaxLength(qbtTag, TRACKER_TAG_MAX, "qBittorrent tag")
    if (qbtTagErr) return qbtTagErr
  }

  if (typeof mouseholeUrl === "string" && mouseholeUrl.trim()) {
    const mouseholeUrlErr = validateMaxLength(mouseholeUrl.trim(), LONG_STRING_MAX, "Mousehole URL")
    if (mouseholeUrlErr) return mouseholeUrlErr
    const mouseUrlErr = validateHttpUrl(mouseholeUrl.trim(), "Mousehole URL")
    if (mouseUrlErr) return mouseUrlErr
  }

  if (typeof joinedAt === "string" && joinedAt) {
    const joinedAtErr = validateJoinedAt(joinedAt)
    if (joinedAtErr) return joinedAtErr
  }

  if (!VALID_PLATFORM_TYPES.includes(platform as (typeof VALID_PLATFORM_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid platform type" }, { status: 400 })
  }

  try {
    const key = decodeKey(auth)
    const encryptedApiToken = encrypt(trimmedApiToken, key)

    const [tracker] = await db
      .insert(trackers)
      .values({
        name: trimmedName,
        baseUrl: trimmedBaseUrl,
        apiPath: DEFAULT_API_PATHS[platform] ?? "/api/user",
        encryptedApiToken,
        platformType: platform,
        color: (color as string) || CHART_THEME.accent,
        qbtTag: typeof qbtTag === "string" ? qbtTag.trim() : null,
        mouseholeUrl:
          typeof mouseholeUrl === "string" && mouseholeUrl.trim() ? mouseholeUrl.trim() : null,
        joinedAt: typeof joinedAt === "string" && joinedAt ? joinedAt : null,
      })
      .returning()

    // SECURITY: Only return safe fields
    log.info({ route: "POST /api/trackers", trackerId: tracker.id }, "tracker created")
    return NextResponse.json({ id: tracker.id, name: tracker.name }, { status: 201 })
  } catch (err) {
    log.error({ route: "POST /api/trackers", error: errMsg(err) }, "Failed to create tracker")
    return NextResponse.json({ error: "Failed to create tracker" }, { status: 500 })
  }
}
