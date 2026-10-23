// src/app/api/trackers/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  validateHexColor,
  validateJoinedAt,
  validateMaxLength,
  validateMouseholeToken,
  validateMouseholeUrl,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { LONG_STRING_MAX, maxTokenLengthFor, TRACKER_NAME_MAX, TRACKER_TAG_MAX } from "@/lib/limits"
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

  const {
    name,
    slug,
    apiToken,
    color,
    qbtTag,
    mouseholeUrl,
    mouseholeToken,
    joinedAt,
    useFlaresolverr,
  } = body as {
    name?: string
    slug?: string
    apiToken?: string
    color?: string
    qbtTag?: string
    mouseholeUrl?: string
    mouseholeToken?: string
    joinedAt?: string
    useFlaresolverr?: boolean
  }

  if (
    typeof name !== "string" ||
    typeof slug !== "string" ||
    typeof apiToken !== "string" ||
    !name.trim() ||
    !slug.trim() ||
    !apiToken.trim()
  ) {
    return NextResponse.json(
      { error: "name, slug, and apiToken are required strings" },
      { status: 400 }
    )
  }

  // Address, platform and API path are registry data keyed by the slug, so a
  // body cannot point a new row at a site its slug does not own.
  const entry = getTrackerBySlug(slug.trim())
  if (!entry) {
    return NextResponse.json({ error: "Unknown tracker" }, { status: 400 })
  }

  const trimmedName = name.trim()
  const trimmedApiToken = apiToken.trim()

  const nameErr = validateMaxLength(trimmedName, TRACKER_NAME_MAX, "Name")
  if (nameErr) return nameErr

  const maxTokenLength = maxTokenLengthFor(entry.platform)
  const tokenErr = validateMaxLength(trimmedApiToken, maxTokenLength, "API token")
  if (tokenErr) return tokenErr

  if (typeof color === "string") {
    const colorErr = validateHexColor(color)
    if (colorErr) return colorErr
  }

  if (typeof qbtTag === "string") {
    const qbtTagErr = validateMaxLength(qbtTag, TRACKER_TAG_MAX, "qBittorrent tag")
    if (qbtTagErr) return qbtTagErr
  }

  const trimmedMouseholeUrl = typeof mouseholeUrl === "string" ? mouseholeUrl.trim() : ""
  if (trimmedMouseholeUrl) {
    const mouseholeUrlErr = validateMaxLength(trimmedMouseholeUrl, LONG_STRING_MAX, "Mousehole URL")
    if (mouseholeUrlErr) return mouseholeUrlErr
    const mouseUrlErr = validateMouseholeUrl(trimmedMouseholeUrl)
    if (mouseUrlErr) return mouseUrlErr
  }

  const trimmedMouseholeToken = typeof mouseholeToken === "string" ? mouseholeToken.trim() : ""
  if (trimmedMouseholeToken) {
    const mouseholeTokenErr = validateMouseholeToken(trimmedMouseholeToken)
    if (mouseholeTokenErr) return mouseholeTokenErr
    if (!trimmedMouseholeUrl) {
      return NextResponse.json(
        { error: "Mousehole API token needs a Mousehole URL" },
        { status: 400 }
      )
    }
  }

  if (typeof joinedAt === "string" && joinedAt) {
    const joinedAtErr = validateJoinedAt(joinedAt)
    if (joinedAtErr) return joinedAtErr
  }

  try {
    const key = decodeKey(auth)
    const encryptedApiToken = encrypt(trimmedApiToken, key)

    const [tracker] = await db
      .insert(trackers)
      .values({
        name: trimmedName,
        registrySlug: entry.slug,
        baseUrl: entry.url,
        apiPath: entry.apiPath,
        encryptedApiToken,
        platformType: entry.platform,
        color: color || entry.color,
        qbtTag: typeof qbtTag === "string" ? qbtTag.trim() : null,
        mouseholeUrl: trimmedMouseholeUrl || null,
        encryptedMouseholeToken: trimmedMouseholeToken ? encrypt(trimmedMouseholeToken, key) : null,
        joinedAt: typeof joinedAt === "string" && joinedAt ? joinedAt : null,
        useFlaresolverr: useFlaresolverr === true,
      })
      .returning()

    // SECURITY: Only return safe fields
    log.info(
      { route: "POST /api/trackers", trackerId: tracker.id, trackerName: tracker.name },
      `tracker created: ${tracker.name}`
    )
    return NextResponse.json({ id: tracker.id, name: tracker.name }, { status: 201 })
  } catch (err) {
    log.error({ route: "POST /api/trackers", error: errMsg(err) }, "Failed to create tracker")
    return NextResponse.json({ error: "Failed to create tracker" }, { status: 500 })
  }
}
