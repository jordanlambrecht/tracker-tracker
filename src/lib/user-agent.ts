// src/lib/user-agent.ts
//
// Exports: DEFAULT_USER_AGENT
// Functions: withDefaultUserAgent

import "server-only"
import packageJson from "../../package.json"

/**
 * Sent on every outbound tracker request that does not already carry a
 * User-Agent of its own.
 *
 * Some trackers reject a request with no User-Agent header outright, before
 * they look at the session cookie — MyAnonaMouse answers `400 Bad request`
 * ("Your browser sent an invalid request"), which is indistinguishable from a
 * malformed request until you compare it against the same call with a header
 * attached. Identifying ourselves is also simply better manners toward a
 * tracker operator reading their access log.
 *
 * Major.minor only. The exact patch version is a rare enough string to link a
 * user's accounts across trackers, which defeats the point of routing them all
 * through one proxy. Major.minor still identifies the app and stays useful when
 * diagnosing a report.
 */
const [major, minor] = packageJson.version.split(".")
export const DEFAULT_USER_AGENT = `tracker-tracker/${major}.${minor}`

/**
 * Adds {@link DEFAULT_USER_AGENT} unless the caller set one.
 *
 * The check is case-insensitive on purpose: adapters that scrape with a
 * copied browser session send `User-Agent`, and a second header differing only
 * in case would be sent alongside it rather than replacing it. Those adapters
 * must keep the exact UA the cookie was issued to — a mismatch is what the
 * tracker's session fingerprinting looks for.
 */
export function withDefaultUserAgent(
  headers: Record<string, string> = {}
): Record<string, string> {
  const hasUserAgent = Object.keys(headers).some((key) => key.toLowerCase() === "user-agent")
  return hasUserAgent ? headers : { ...headers, "User-Agent": DEFAULT_USER_AGENT }
}
