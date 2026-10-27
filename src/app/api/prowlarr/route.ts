// src/app/api/prowlarr/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, readPublicUrl } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { normalizeProwlarrUrl } from "@/lib/prowlarr/client"
import {
  validateProwlarrApiKey,
  validateProwlarrName,
  validateProwlarrUrl,
} from "@/lib/prowlarr/validate"
import { requestProwlarrPoll } from "@/lib/prowlarr-scheduler"
import { fetchProwlarrInstances, serializeProwlarrInstance } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const instances = await fetchProwlarrInstances()
  return NextResponse.json(instances.map(serializeProwlarrInstance))
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { name, url, publicUrl, apiKey, enabled } = body as {
    name?: unknown
    url?: unknown
    publicUrl?: unknown
    apiKey?: unknown
    enabled?: unknown
  }
  if (typeof name !== "string" || typeof url !== "string" || typeof apiKey !== "string") {
    return NextResponse.json({ error: "name, url and apiKey are required" }, { status: 400 })
  }
  if (typeof enabled !== "undefined" && typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 })
  }

  const nameErr = validateProwlarrName(name)
  if (nameErr) return nameErr
  const urlErr = validateProwlarrUrl(url)
  if (urlErr) return urlErr
  const apiKeyErr = validateProwlarrApiKey(apiKey)
  if (apiKeyErr) return apiKeyErr
  const browserUrl = readPublicUrl(publicUrl)
  if (browserUrl instanceof NextResponse) return browserUrl

  const key = decodeKey(auth)
  try {
    const [instance] = await db
      .insert(prowlarrInstances)
      .values({
        name: name.trim(),
        url: normalizeProwlarrUrl(url),
        publicUrl: browserUrl ?? null,
        encryptedApiKey: encrypt(apiKey.trim(), key),
        enabled: enabled ?? true,
      })
      .returning({ id: prowlarrInstances.id, name: prowlarrInstances.name })

    log.info({ route: "POST /api/prowlarr", prowlarrInstanceId: instance.id }, "Prowlarr added")
    // Not awaited, so the first reading is stored within seconds instead of at the next tick.
    requestProwlarrPoll(instance.id, key, { readIndexers: true }).catch((err) => {
      log.warn({ prowlarrInstanceId: instance.id, error: errMsg(err) }, "Initial Prowlarr poll")
    })
    return NextResponse.json(instance, { status: 201 })
  } catch (err) {
    log.error({ route: "POST /api/prowlarr", error: errMsg(err) }, "Failed to add Prowlarr")
    return NextResponse.json({ error: "Failed to add Prowlarr instance" }, { status: 500 })
  }
}
