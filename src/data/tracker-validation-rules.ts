// src/data/tracker-validation-rules.ts
//
// Shared constants and predicates for tracker registry validation.
// Used by both the CI script and the test suite.

import { isIP } from "node:net"
import { registryHostname, type TrackerRegistryEntry } from "@/data/tracker-registry"
import { stripTrailingSlash } from "@/lib/data-transforms"
import { isUnsafeNetworkHost } from "@/lib/network"
import { trackerHostKey } from "@/lib/tracker-matching"

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const LOGO_NAME_RE = /^\/tracker-logos\/[a-z0-9_]+_logo\.(svg|png)$/
export const PLACEHOLDER_RE = /^TODO$/i

/**
 * `defunctDate` must be a plain "YYYY-MM-DD" calendar date. The same shape as a
 * tracker row's `joinedAt`, so it renders through `formatJoinedDate()`. A free-form
 * display string ("May 2026") would parse to Invalid Date there.
 */
const DEFUNCT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A bare lowercase hostname: no scheme, port, path or query. */
const ANNOUNCE_HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

export const VALID_CONTENT_CATEGORIES = new Set([
  "Movies",
  "TV",
  "Music",
  "Games",
  "Apps",
  "Sports",
  "Books",
  "Audiobooks",
  "Comics",
  "Manga",
  "Anime",
  "XXX",
  "Documentaries",
  "Education",
  "Tutorials",
  "Fanres",
])

export function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (typeof val === "string" && val.trim() === "") return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

/**
 * Validates the four `defunct*` fields as a group.
 *
 * These drive a banner that tells the user to archive their tracker, so a
 * half-filled entry is worse than none: a shutdown notice with no date and no
 * explanation reads as a bug. `defunct: true` therefore requires both the date
 * and the message, and the date must be a real calendar day because the UI
 * parses it. Details set *without* `defunct: true` are inert rather than
 * broken (most likely a half-finished edit), so those only warn.
 *
 * This lives here, not in the CI script, because the script cannot be imported
 * (it runs `process.exit` / `console.log` on module load) and the registry test
 * suite has to apply the identical rule to the shipped data.
 */
export function validateDefunct(tracker: Partial<TrackerRegistryEntry>): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (tracker.defunct) {
    if (isEmpty(tracker.defunctDate)) {
      errors.push("defunct is true but defunctDate is missing")
    } else if (!DEFUNCT_DATE_RE.test(tracker.defunctDate as string)) {
      errors.push(`defunctDate must be "YYYY-MM-DD" (got "${tracker.defunctDate}")`)
    } else {
      // The regex admits "2026-02-31". Round-tripping through Date catches the
      // rollover that would otherwise render as a plausible-looking wrong day.
      const iso = tracker.defunctDate as string
      const parsed = new Date(`${iso}T00:00:00`)
      if (Number.isNaN(parsed.getTime()) || !parsed.toLocaleDateString("en-CA").startsWith(iso)) {
        errors.push(`defunctDate "${iso}" is not a real calendar date`)
      }
    }
    if (isEmpty(tracker.defunctMessage)) {
      errors.push("defunct is true but defunctMessage is missing")
    }
  } else {
    for (const [field, value] of [
      ["defunctMessage", tracker.defunctMessage],
      ["defunctLink", tracker.defunctLink],
      ["defunctDate", tracker.defunctDate],
    ] as const) {
      if (!isEmpty(value)) warnings.push(`${field} is set but defunct is not true`)
    }
  }

  if (!isEmpty(tracker.defunctLink)) {
    const link = tracker.defunctLink as string
    if (!/^https:\/\//.test(link)) {
      errors.push(`defunctLink must use https:// (got "${link}")`)
    } else {
      try {
        new URL(link)
      } catch {
        errors.push(`defunctLink is not a valid URL (got "${link}")`)
      }
    }
  }

  return { errors, warnings }
}

/**
 * A host list entry must already be its own registrable domain. The matcher
 * reduces a host to that, so a pasted announce URL or a passkey subdomain would
 * still work and nothing else would catch the passkey. The matcher keeps an IP
 * address or a local name whole, so those are refused here.
 */
function isRegistrableDomain(host: string): boolean {
  return (
    ANNOUNCE_HOST_RE.test(host) &&
    trackerHostKey(host) === host &&
    isIP(host) === 0 &&
    !isUnsafeNetworkHost(host)
  )
}

/**
 * Every `announceHosts` entry must be a registrable domain. The message names
 * the index, not the value, so CI output never repeats a passkey. An empty list
 * fails too, since a present field says someone checked.
 */
export function validateAnnounceHosts(tracker: Partial<TrackerRegistryEntry>): string[] {
  if (tracker.announceHosts !== undefined && tracker.announceHosts.length === 0) {
    return ["announceHosts is empty, so leave it out until someone checks where torrents announce"]
  }
  return (tracker.announceHosts ?? []).flatMap((host, i) =>
    isRegistrableDomain(host)
      ? []
      : [`announceHosts[${i}] must be a lowercase registrable domain, never a URL or subdomain`]
  )
}

/**
 * `previousHosts` follows the announceHosts rule, since attribution reads it
 * too. The entry's own url host isn't a previous one.
 */
export function validatePreviousHosts(tracker: Partial<TrackerRegistryEntry>): string[] {
  if (tracker.previousHosts !== undefined && tracker.previousHosts.length === 0) {
    return ["previousHosts is empty, so leave it out"]
  }
  const ownHost = tracker.url ? registryHostname(tracker.url) : undefined
  return (tracker.previousHosts ?? []).flatMap((host, i) => {
    if (!isRegistrableDomain(host)) {
      return [
        `previousHosts[${i}] must be a lowercase registrable domain, never a URL or subdomain`,
      ]
    }
    return host === ownHost ? [`previousHosts[${i}] is the host of this entry's own url`] : []
  })
}

/**
 * Host keys claimed by more than one entry through an announce or previous host.
 * resolveTorrentTracker takes the first tracker whose keys hold a torrent's host
 * and fleet aggregation takes the last, and the startup backfill links a row to
 * the first entry on its host, so a shared host hands one tracker's torrents or
 * rows to whichever wins. An entry may repeat its own hosts.
 */
export function findSharedHosts(
  entries: readonly TrackerRegistryEntry[]
): { host: string; slugs: string[] }[] {
  const owners = new Map<string, Set<string>>()
  const aliases = new Set<string>()
  const claim = (host: string, slug: string, alias: boolean) => {
    const key = trackerHostKey(host)
    if (!key) return
    owners.set(key, (owners.get(key) ?? new Set()).add(slug))
    if (alias) aliases.add(key)
  }
  for (const entry of entries) {
    claim(entry.url, entry.slug, false)
    for (const host of [...(entry.announceHosts ?? []), ...(entry.previousHosts ?? [])]) {
      claim(host, entry.slug, true)
    }
  }
  return [...owners]
    .filter(([key, slugs]) => aliases.has(key) && slugs.size > 1)
    .map(([host, slugs]) => ({ host, slugs: [...slugs] }))
}

/**
 * A registry `url` must be exactly its own origin, with no port and no trailing
 * dot on the host. Adapters both concatenate onto it and pass it to `new URL`,
 * and the two forms treat anything past the origin differently. Concatenation
 * doubles a trailing slash, for one. Every user's token is sent there, so it is
 * never a private or local address either.
 */
export function validateTrackerUrl(url: string): string[] {
  if (!/^https:\/\//.test(url)) return ["URL must use https://"]
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return ["Invalid URL format"]
  }
  if (isUnsafeNetworkHost(parsed.hostname)) return ["URL must not be a private or local address"]
  // The hostname, unlike the origin, leaves out the port, and URL keeps a trailing dot.
  const expected = `${parsed.protocol}//${parsed.hostname.replace(/\.$/, "")}`
  return url === expected
    ? []
    : [`URL must be exactly its origin (got "${url}", expected "${expected}")`]
}

/**
 * stripTrailingSlash plus case folding, for comparing two registry URLs for
 * sameness. Never for a stored base URL, which must keep its case.
 */
export function normalizeTrackerUrl(url: string): string {
  return stripTrailingSlash(url).toLowerCase()
}
