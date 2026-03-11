// src/app/api/settings/proxy-test/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, validatePort } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { createProxyAgent, PROXY_HOST_PATTERN, proxyFetch, VALID_PROXY_TYPES, type ProxyType } from "@/lib/proxy"
const TEST_URL = "https://httpbin.org/ip"
// Loose IP pattern — IPv4, IPv6, or comma-separated (httpbin returns this)
const IP_PATTERN = /^[\d.,: a-fA-F]+$/

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { proxyType, proxyHost, proxyPort, proxyUsername, proxyPassword, useStoredPassword } = body as {
    proxyType?: string
    proxyHost?: string
    proxyPort?: number
    proxyUsername?: string
    proxyPassword?: string
    useStoredPassword?: boolean
  }

  if (!proxyHost || typeof proxyHost !== "string") {
    return NextResponse.json({ error: "proxyHost is required" }, { status: 400 })
  }

  if (proxyHost.length > 255) {
    return NextResponse.json({ error: "Proxy host must be 255 characters or fewer" }, { status: 400 })
  }

  if (!PROXY_HOST_PATTERN.test(proxyHost)) {
    return NextResponse.json({ error: "Invalid proxy host format" }, { status: 400 })
  }

  if (!proxyType || !VALID_PROXY_TYPES.has(proxyType)) {
    return NextResponse.json({ error: `proxyType must be one of: ${[...VALID_PROXY_TYPES].join(", ")}` }, { status: 400 })
  }

  const port = typeof proxyPort === "number" ? proxyPort : 1080
  const portErr = validatePort(port)
  if (portErr) return portErr

  // Resolve password: use stored encrypted password or client-provided plaintext
  let resolvedPassword: string | null = proxyPassword || null
  if (useStoredPassword && !proxyPassword) {
    const [settings] = await db
      .select({ encryptedProxyPassword: appSettings.encryptedProxyPassword })
      .from(appSettings)
      .limit(1)

    if (settings?.encryptedProxyPassword) {
      try {
        const key = decodeKey(auth)
        resolvedPassword = decrypt(settings.encryptedProxyPassword, key)
      } catch {
        return NextResponse.json(
          { success: false, error: "Failed to decrypt stored proxy password" },
          { status: 500 }
        )
      }
    }
  }

  try {
    const agent = createProxyAgent({
      type: proxyType as ProxyType,
      host: proxyHost,
      port,
      username: proxyUsername || null,
      password: resolvedPassword,
    })

    const response = await proxyFetch(TEST_URL, agent, { timeoutMs: 10000 })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Test request returned ${response.status}` },
        { status: 422 }
      )
    }

    const data = (await response.json()) as { origin?: string }

    // Sanitize origin — only return if it matches an IP-like pattern
    const origin = typeof data.origin === "string" && IP_PATTERN.test(data.origin)
      ? data.origin
      : null

    return NextResponse.json({
      success: true,
      proxyIp: origin,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed"
    return NextResponse.json({ success: false, error: message }, { status: 422 })
  }
}
