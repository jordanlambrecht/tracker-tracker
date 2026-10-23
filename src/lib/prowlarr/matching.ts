// src/lib/prowlarr/matching.ts
//
// Functions: parseIndexerOverride, formatIndexerOverride, isValidIndexerOverride,
//            normalizeHost, hostsFromUrls, trackerHosts, matchTrackerIndexers
//
// Pairs a tracker with the Prowlarr indexers for the same site. Automatic
// matching compares hostnames; a tracker can instead pin one indexer, or opt
// out, through trackers.prowlarr_indexer.

import { registryEntryFor } from "@/data/tracker-registry"
import { trackerHostKey } from "@/lib/tracker-matching"

export const PROWLARR_NO_INDEXER = "none"

type IndexerOverride =
  { kind: "auto" } | { kind: "none" } | { kind: "indexer"; instanceId: number; indexerId: number }

const OVERRIDE_RE = /^([1-9]\d{0,9}):([1-9]\d{0,9})$/

/** Reads the stored override. Anything unrecognised falls back to automatic matching. */
export function parseIndexerOverride(raw: string | null | undefined): IndexerOverride {
  if (!raw) return { kind: "auto" }
  if (raw === PROWLARR_NO_INDEXER) return { kind: "none" }
  const match = OVERRIDE_RE.exec(raw)
  if (!match) return { kind: "auto" }
  return { kind: "indexer", instanceId: Number(match[1]), indexerId: Number(match[2]) }
}

export function formatIndexerOverride(instanceId: number, indexerId: number): string {
  return `${instanceId}:${indexerId}`
}

export function isValidIndexerOverride(raw: string): boolean {
  return raw === PROWLARR_NO_INDEXER || OVERRIDE_RE.test(raw)
}

/** Lowercased hostname without a trailing dot or a leading "www.", or null if unparseable. */
export function normalizeHost(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim()
  if (!raw) return null
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
    const host = new URL(withScheme).hostname.toLowerCase().replace(/\.$/, "")
    return host.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

export function hostsFromUrls(urls: readonly (string | null | undefined)[]): string[] {
  const hosts = new Set<string>()
  for (const url of urls) {
    const host = normalizeHost(url)
    if (host) hosts.add(host)
  }
  return [...hosts]
}

interface MatchableTracker {
  baseUrl: string
  registrySlug: string | null
  prowlarrIndexer?: string | null
}

interface MatchableIndexer {
  instanceId: number
  indexerId: number
  hosts: readonly string[]
}

/** The tracker's configured URL plus its registry URL, which can differ after a domain move. */
export function trackerHosts(tracker: MatchableTracker): string[] {
  return hostsFromUrls([tracker.baseUrl, registryEntryFor(tracker)?.url])
}

/**
 * Exact hostname matches take precedence. The registrable domain is compared
 * only when no hostname matches exactly, so `example.org` still matches an
 * indexer configured as `tracker.example.org`, and a sibling subdomain never
 * replaces an exact match.
 */
export function matchTrackerIndexers<I extends MatchableIndexer>(
  tracker: MatchableTracker,
  indexers: readonly I[]
): { matchedBy: "auto" | "manual"; indexers: I[] } | null {
  const override = parseIndexerOverride(tracker.prowlarrIndexer)
  if (override.kind === "none") return null
  if (override.kind === "indexer") {
    const pinned = indexers.filter(
      (i) => i.instanceId === override.instanceId && i.indexerId === override.indexerId
    )
    return pinned.length > 0 ? { matchedBy: "manual", indexers: pinned } : null
  }

  const own = trackerHosts(tracker)
  if (own.length === 0) return null
  const ownSet = new Set(own)
  const exact = indexers.filter((i) => i.hosts.some((h) => ownSet.has(h)))
  if (exact.length > 0) return { matchedBy: "auto", indexers: exact }

  const ownKeys = new Set(own.map(trackerHostKey).filter((k): k is string => k !== null))
  const loose = indexers.filter((i) =>
    i.hosts.some((h) => {
      const key = trackerHostKey(h)
      return key !== null && ownKeys.has(key)
    })
  )
  return loose.length > 0 ? { matchedBy: "auto", indexers: loose } : null
}

export type { IndexerOverride }
