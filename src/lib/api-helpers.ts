// src/lib/api-helpers.ts
//
// Functions: authenticate, parseRouteId, parseTrackerId, parseJsonBody,
//            validateHttpUrl, validateMouseholeUrl, validateMouseholeToken, validateFlareSolverrUrl,
//            validateHexColor, validatePort, validatePastDate, validateJoinedAt,
//            validateLastAccessAt, validateIntRange, validateMaxLength,
//            validateAuthMethod, validateUrlPath, validateClientHost, decodeKey

import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
// Imported from the module rather than the barrel: the barrel pulls in
// credentials.ts, which is "server-only".
import { VALID_AUTH_METHODS } from "@/lib/download-clients/types"
import { localDateStr } from "@/lib/formatters"
import { CREDENTIAL_MAX, URL_PATH_MAX } from "@/lib/limits"
import { isUnsafeNetworkHost } from "@/lib/network"
import { DATE_RE, isValidHex, isValidPort } from "@/lib/validators"

/** Shared route handler context for dynamic [id] segments */
export type RouteContext<P = { id: string }> = {
  params: Promise<P>
}

export async function authenticate(): Promise<NextResponse | { encryptionKey: string }> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return session
}

export async function parseRouteId(
  params: Promise<{ id: string }>,
  label: string
): Promise<NextResponse | number> {
  const { id } = await params
  const parsed = parseInt(id, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 })
  }
  return parsed
}

export async function parseTrackerId(
  params: Promise<{ id: string }>
): Promise<NextResponse | number> {
  return parseRouteId(params, "tracker ID")
}

export async function parseJsonBody(
  request: Request
): Promise<NextResponse | Record<string, unknown>> {
  try {
    return await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
}

export function validateHttpUrl(url: string, label = "baseUrl"): NextResponse | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: `${label} must use https:// or http://` }, { status: 400 })
    }
    if (isUnsafeNetworkHost(parsed.hostname)) {
      return NextResponse.json(
        { error: `${label} must not target localhost or a private network address` },
        { status: 400 }
      )
    }
    return null
  } catch {
    return NextResponse.json({ error: `Invalid ${label} format` }, { status: 400 })
  }
}

/**
 * validateHttpUrl plus a refusal of userinfo. The Mousehole API token has its
 * own encrypted column, so a URL carrying one would store the secret in
 * plaintext and send it nowhere.
 */
export function validateMouseholeUrl(url: string): NextResponse | null {
  const urlErr = validateHttpUrl(url, "Mousehole URL")
  if (urlErr) return urlErr
  const parsed = new URL(url)
  if (parsed.username || parsed.password) {
    return NextResponse.json(
      {
        error:
          "Mousehole URL must not contain a token or password. Enter the token in the Mousehole API token field",
      },
      { status: 400 }
    )
  }
  return null
}

/** validateHttpUrl, and also rejects a username or password, which FlareSolverr does not use. */
export function validateFlareSolverrUrl(url: string): NextResponse | null {
  const urlErr = validateHttpUrl(url, "FlareSolverr URL")
  if (urlErr) return urlErr
  const parsed = new URL(url)
  if (parsed.username || parsed.password) {
    return NextResponse.json(
      { error: "FlareSolverr URL must not contain a username or password" },
      { status: 400 }
    )
  }
  return null
}

/**
 * NUL, CR and LF make undici throw a TypeError that quotes the whole header,
 * and the rest of the control range would go on the wire, so both are refused
 * here. A non-Latin-1 character cannot be sent in a header at all. Messages
 * name the character by code point and never echo the token.
 */
export function validateMouseholeToken(token: string): NextResponse | null {
  const lengthErr = validateMaxLength(token, CREDENTIAL_MAX, "Mousehole API token")
  if (lengthErr) return lengthErr

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
  const control = token.match(/[\x00-\x1F\x7F]/)
  if (control) {
    const code = control[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    return NextResponse.json(
      {
        error: `Mousehole API token contains a control character (U+${code}) at position ${control.index}. Copy only the token value`,
      },
      { status: 400 }
    )
  }

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
  const nonLatin1 = token.match(/[^\x00-\xFF]/)
  if (nonLatin1) {
    const code = nonLatin1[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    return NextResponse.json(
      {
        error: `Mousehole API token contains a non-Latin-1 character (U+${code}) at position ${nonLatin1.index}. Re-copy the full token`,
      },
      { status: 400 }
    )
  }

  return null
}

export function validateHexColor(color: string): NextResponse | null {
  if (!isValidHex(color, true)) {
    return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 })
  }
  return null
}

export function validatePort(port: number): NextResponse | null {
  if (!isValidPort(port)) {
    return NextResponse.json(
      { error: "Port must be an integer between 1 and 65535" },
      { status: 400 }
    )
  }
  return null
}

/**
 * A calendar date that cannot be in the future. `field` names the request key so
 * the format error is actionable; `label` reads as a noun phrase in the second.
 * Dates are compared as strings against localDateStr(), so "today" follows the
 * configured TZ rather than the server's UTC clock.
 */
function validatePastDate(value: string, field: string, label: string): NextResponse | null {
  if (!DATE_RE.test(value)) {
    return NextResponse.json({ error: `${field} must be YYYY-MM-DD` }, { status: 400 })
  }
  if (value > localDateStr()) {
    return NextResponse.json({ error: `${label} cannot be in the future` }, { status: 400 })
  }
  return null
}

export function validateJoinedAt(value: string): NextResponse | null {
  return validatePastDate(value, "joinedAt", "Join date")
}

export function validateLastAccessAt(value: string): NextResponse | null {
  return validatePastDate(value, "lastAccessAt", "Last login date")
}

export function validateIntRange(
  value: number,
  min: number,
  max: number,
  label: string,
  message?: string
): NextResponse | null {
  if (!Number.isInteger(value) || value < min || value > max) {
    return NextResponse.json(
      { error: message ?? `${label} must be between ${min} and ${max}` },
      { status: 400 }
    )
  }
  return null
}

export function validateMaxLength(value: string, max: number, label: string): NextResponse | null {
  if (value.length > max) {
    return NextResponse.json(
      { error: `${label} must be ${max} characters or fewer` },
      { status: 400 }
    )
  }
  return null
}

/** Reject a download-client auth method that is not one we implement. */
export function validateAuthMethod(value: string): NextResponse | null {
  if (!(VALID_AUTH_METHODS as readonly string[]).includes(value)) {
    return NextResponse.json(
      { error: `authMethod must be one of: ${VALID_AUTH_METHODS.join(", ")}` },
      { status: 400 }
    )
  }
  return null
}

/**
 * Validate an optional URL path prefix. Empty string is valid (no prefix).
 * Every endpoint is appended to the path, so the path must come back from the
 * URL parser exactly as typed: anything it would read as a query, a fragment,
 * a dot segment or a separator, or would percent-encode, is refused.
 */
export function validateUrlPath(value: string): NextResponse | null {
  if (value === "") return null
  if (value.length > URL_PATH_MAX) {
    return NextResponse.json(
      { error: `URL path must be ${URL_PATH_MAX} characters or fewer` },
      { status: 400 }
    )
  }
  if (!value.startsWith("/")) {
    return NextResponse.json({ error: "URL path must start with /" }, { status: 400 })
  }
  // The routes store the path through stripTrailingSlash, so this would save as no path.
  if (/^\/+$/.test(value)) {
    return NextResponse.json({ error: "URL path must not be only slashes" }, { status: 400 })
  }
  if (!survivesUrlParser(value)) {
    return NextResponse.json(
      {
        error:
          "URL path must be a plain path like /proxy/<key>, without spaces, ?, #, \\ or dot segments",
      },
      { status: 400 }
    )
  }
  return null
}

function survivesUrlParser(path: string): boolean {
  try {
    // A query or fragment ends the pathname early, so equality covers them too.
    return new URL(path, "http://host.invalid").pathname === path
  } catch {
    return false
  }
}

/**
 * Validate a download client's host after sanitizeHost and the host pattern.
 * The client URL is built as host:port, so a host the URL parser refuses there
 * (one carrying its own port, a bare IPv6 address, stray brackets) fails every poll.
 */
export function validateClientHost(host: string): NextResponse | null {
  if (!URL.canParse(`http://${host}:1`)) {
    return NextResponse.json(
      {
        error:
          "Host must not include a port. Use the Port field, and write an IPv6 address in brackets, like [::1]",
      },
      { status: 400 }
    )
  }
  return null
}

export function decodeKey(auth: { encryptionKey: string }): Buffer {
  return Buffer.from(auth.encryptionKey, "hex")
}
