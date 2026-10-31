// src/lib/prowlarr/validate.ts
//
// Functions: validateProwlarrName, validateProwlarrUrl, validateProwlarrApiKey

import { NextResponse } from "next/server"
import { CREDENTIAL_MAX, SHORT_NAME_MAX } from "@/lib/limits"
import { prowlarrUrlError } from "@/lib/prowlarr/client"

export function validateProwlarrName(name: string): NextResponse | null {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > SHORT_NAME_MAX) {
    return NextResponse.json(
      { error: `Name must be between 1 and ${SHORT_NAME_MAX} characters` },
      { status: 400 }
    )
  }
  return null
}

export function validateProwlarrUrl(url: string): NextResponse | null {
  const error = prowlarrUrlError(url.trim())
  return error ? NextResponse.json({ error }, { status: 400 }) : null
}

/**
 * The key is sent as a header, so only printable ASCII is accepted. A control
 * character would make undici throw an error that quotes the whole header.
 */
export function validateProwlarrApiKey(apiKey: string): NextResponse | null {
  const trimmed = apiKey.trim()
  if (!trimmed) return NextResponse.json({ error: "API key is required" }, { status: 400 })
  if (trimmed.length > CREDENTIAL_MAX) {
    return NextResponse.json(
      { error: `API key must be ${CREDENTIAL_MAX} characters or fewer` },
      { status: 400 }
    )
  }
  if (!/^[\x21-\x7E]+$/.test(trimmed)) {
    return NextResponse.json(
      { error: "API key must contain only printable characters without spaces" },
      { status: 400 }
    )
  }
  return null
}
