// src/lib/user-agent.ts
//
// Exports: DEFAULT_USER_AGENT
// Functions: withDefaultUserAgent

import "server-only"
import packageJson from "../../package.json"

/**
 * Sent on every outbound tracker request that does not already carry one.
 *
 * Some trackers reject a request with no User-Agent before they read the
 * session cookie. MyAnonaMouse answers `400 Bad request`, which looks like a
 * credential problem rather than a header one.
 *
 * Major.minor only. An exact patch version is rare enough to link a user's
 * accounts across trackers, defeating the point of one shared proxy.
 */
const [major = "0", minor = "0"] = packageJson.version.split(".")
export const DEFAULT_USER_AGENT = `tracker-tracker/${major}.${minor}`

/**
 * Adds {@link DEFAULT_USER_AGENT} unless the caller set one.
 *
 * Case-insensitive on purpose. A key differing only in case would add a second
 * header rather than replace the first. Scraping adapters must keep the exact
 * UA their cookie was issued to, which is what session fingerprinting checks.
 */
export function withDefaultUserAgent(
  headers: Record<string, string> = {}
): Record<string, string> {
  const hasUserAgent = Object.keys(headers).some((key) => key.toLowerCase() === "user-agent")
  return hasUserAgent ? headers : { ...headers, "User-Agent": DEFAULT_USER_AGENT }
}
