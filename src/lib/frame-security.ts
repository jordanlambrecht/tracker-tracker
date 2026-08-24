// src/lib/frame-security.ts

/**
 * Framing policy, modelled on Appsmith's `APPSMITH_ALLOWED_FRAME_ANCESTORS`
 * (deploy/docker/fs/opt/appsmith/caddy-reconfigure.mjs).
 *
 * The problem this solves: a self-hosted dashboard (Organizr, Homarr, Heimdall)
 * lives on a different origin to this app, and `X-Frame-Options` cannot express
 * "that origin may frame me". Its `ALLOW-FROM` form is unsupported in every
 * current browser, leaving only DENY and SAMEORIGIN. CSP `frame-ancestors` is
 * the modern directive that does take an origin list, and it supersedes
 * `X-Frame-Options` wherever both are understood.
 *
 * Default is unchanged from hardcoded DENY: no origin may frame the app. Naming
 * an origin narrows the exception to that origin — it never opens framing to all.
 * There is deliberately no "off" switch.
 */

export const FRAME_OPTIONS_HEADER = "X-Frame-Options"
export const CSP_HEADER = "Content-Security-Policy"
export const ALLOWED_FRAME_ANCESTORS_ENV = "ALLOWED_FRAME_ANCESTORS"

/**
 * A single origin: scheme, host, optional port. Optionally a `*.` subdomain
 * wildcard, which CSP supports and which Appsmith also allows.
 *
 * Everything else is rejected, which is what keeps the env var out of the header
 * as arbitrary text. A bare `*`, `data:`, `blob:`, a `'unsafe-*'` keyword, a
 * second CSP directive smuggled in after a `;`, or stray whitespace all fail
 * this and are dropped rather than sanitized into something plausible.
 */
const ORIGIN_PATTERN = /^https?:\/\/(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/i

export interface FramePolicy {
  /** Origins permitted to frame the app, beyond the app's own origin. */
  allowed: string[]
  /** Tokens that were rejected, so the caller can warn rather than fail silently. */
  rejected: string[]
}

export function parseAllowedFrameAncestors(raw: string | undefined): FramePolicy {
  const allowed: string[] = []
  const rejected: string[] = []

  for (const token of (raw ?? "").split(/[\s,]+/)) {
    if (token === "") continue
    // 'self' is implied and always emitted; accepting it here keeps the Appsmith
    // style value ("'self' https://dash.example.com") working verbatim.
    if (token === "'self'") continue
    if (ORIGIN_PATTERN.test(token)) {
      if (!allowed.includes(token)) allowed.push(token)
    } else {
      rejected.push(token)
    }
  }

  return { allowed, rejected }
}

/**
 * Framing headers for the current configuration.
 *
 * With no configured origins the app is unframeable, and both headers say so —
 * `X-Frame-Options` for browsers that predate `frame-ancestors`, and the CSP for
 * everything current.
 *
 * With origins configured, `X-Frame-Options` is omitted rather than downgraded:
 * it cannot express the allow-list, and leaving `DENY` in place would be honoured
 * by any client that does not understand CSP, contradicting the policy. The CSP
 * is then the single source of truth, and it is narrower than SAMEORIGIN would be.
 */
export function frameSecurityHeaders(
  raw: string | undefined = process.env[ALLOWED_FRAME_ANCESTORS_ENV]
): Record<string, string> {
  const { allowed } = parseAllowedFrameAncestors(raw)

  if (allowed.length === 0) {
    return {
      [FRAME_OPTIONS_HEADER]: "DENY",
      [CSP_HEADER]: "frame-ancestors 'none'",
    }
  }

  return {
    [CSP_HEADER]: `frame-ancestors 'self' ${allowed.join(" ")}`,
  }
}

export function applyFrameSecurityHeaders(headers: Headers): void {
  // Delete first: a configured allow-list must not leave a stale DENY behind.
  headers.delete(FRAME_OPTIONS_HEADER)
  headers.delete(CSP_HEADER)
  for (const [key, value] of Object.entries(frameSecurityHeaders())) {
    headers.set(key, value)
  }
}
