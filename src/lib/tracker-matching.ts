// src/lib/tracker-matching.ts
//
// Functions: trackerHostKey, announceMatchesTracker, resolveTorrentTracker
//
// Resolves a torrent to one of the user's trackers. Matching used to rely
// solely on a qBittorrent tag, which silently dropped every torrent for users
// who don't tag per-tracker (issue #152). The torrent's announce URL is
// already captured, so fall back to matching on that.

import { parseTorrentTags } from "@/lib/fleet"

/**
 * Public suffixes with two labels. Without these, `example.co.uk` would
 * reduce to `co.uk` and match every other UK site. Not exhaustive — it only
 * needs to cover suffixes a private tracker plausibly uses.
 */
const TWO_LABEL_SUFFIXES: ReadonlySet<string> = new Set([
  "co.uk",
  "org.uk",
  "me.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.za",
  "com.br",
  "com.mx",
  "co.jp",
  "or.jp",
  "co.kr",
  "com.tr",
  "com.ar",
  "co.in",
])

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * Reduce a hostname (or full URL) to the part that identifies the site.
 *
 * Announce URLs and web URLs for the same tracker routinely differ by
 * subdomain — `tracker.example.org/announce` vs `https://www.example.org` —
 * so both sides are reduced to `example.org` before comparison.
 *
 * Returns null when the input isn't parseable as a host.
 */
export function trackerHostKey(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim().toLowerCase()
  if (!raw) return null

  let host: string
  try {
    // Accept "https://host/path", "udp://host:port/announce" and a bare host.
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`
    host = new URL(withScheme).hostname
  } catch {
    return null
  }

  host = host.replace(/\.$/, "").replace(/^\[|\]$/g, "")
  if (!host) return null

  // IPs and single-label hosts have no registrable core to reduce to.
  if (IPV4_RE.test(host) || host.includes(":") || !host.includes(".")) return host

  const labels = host.split(".").filter(Boolean)
  if (labels.length < 2) return host

  const lastTwo = labels.slice(-2).join(".")
  const take = TWO_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3 ? 3 : 2
  return labels.slice(-take).join(".")
}

/** True when a torrent's announce URL points at the same site as a tracker. */
export function announceMatchesTracker(
  announceUrl: string | null | undefined,
  trackerBaseUrl: string | null | undefined
): boolean {
  const a = trackerHostKey(announceUrl)
  const b = trackerHostKey(trackerBaseUrl)
  return a !== null && b !== null && a === b
}

interface MatchableTracker {
  qbtTag: string | null
  baseUrl: string
}

interface MatchableTorrent {
  tags?: string | null
  tracker?: string | null
}

/**
 * Resolve a torrent to one of the user's trackers.
 *
 * A qBittorrent tag wins when present — it is an explicit user decision and
 * stays correct for trackers sharing an announce host. Otherwise fall back to
 * the announce URL, which requires no setup at all.
 */
export function resolveTorrentTracker<T extends MatchableTracker>(
  torrent: MatchableTorrent,
  trackers: T[]
): { tracker: T; matchedTag: string | null } | null {
  if (torrent.tags) {
    const torrentTags = parseTorrentTags(torrent.tags)
    for (const tag of torrentTags) {
      const lower = tag.toLowerCase()
      const hit = trackers.find((t) => t.qbtTag && t.qbtTag.toLowerCase() === lower)
      if (hit) return { tracker: hit, matchedTag: tag }
    }
  }

  if (torrent.tracker) {
    const hit = trackers.find((t) => announceMatchesTracker(torrent.tracker, t.baseUrl))
    if (hit) return { tracker: hit, matchedTag: null }
  }

  return null
}
