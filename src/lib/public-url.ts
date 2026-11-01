// src/lib/public-url.ts
//
// Functions: publicUrlError, normalizePublicUrl, browserBase

import { TRACKER_URL_MAX } from "@/lib/limits"

export const PUBLIC_URL_PLACEHOLDER = "https://service.example.com"

export const PUBLIC_URL_TIP =
  "Optional. The address your browser opens this service at, when it differs from the one Tracker Tracker connects to, such as a reverse proxy in front of a Docker container. Links use the connection address when this is blank."

export const CLIENT_PUBLIC_URL_TIP =
  "Optional. The address your browser opens this client's web UI at. When set, the sidebar's client status links to it."

/**
 * Why a public URL is refused, or null when it is usable. Only the browser
 * opens it, so private and local hosts are allowed. Userinfo is refused so a
 * password never sits in a plaintext column and every rendered link, and a
 * query or fragment because links append paths to it.
 */
export function publicUrlError(url: string): string | null {
  if (url.length > TRACKER_URL_MAX) {
    return `Public URL must be ${TRACKER_URL_MAX} characters or fewer`
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "Invalid public URL format"
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Public URL must use http:// or https://"
  }
  if (parsed.username || parsed.password) {
    return "Public URL must not contain a username or password"
  }
  // A bare "?" or "#" parses to an empty search or hash, so the raw string is checked.
  if (/[?#]/.test(url)) return "Public URL must not contain a query or fragment"
  return null
}

/** Trimmed with trailing slashes dropped, or null for a blank value. */
export function normalizePublicUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\/+$/, "")
  return trimmed === "" ? null : trimmed
}

/** Where a link to the service points: the public URL when set, else the connection URL. */
export function browserBase(publicUrl: string | null | undefined, url: string): string {
  return (publicUrl || url).replace(/\/+$/, "")
}
