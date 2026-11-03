// src/lib/db/backfill-registry-slug.ts
//
// Links each tracker row with no registry slug to the entry on its host. Such a
// row predates trackers.registry_slug, sits on a domain its tracker has since
// left, or was added before the tracker list carried its tracker. Called once
// per server start, before polling, and again, forced, after a restore writes
// rows from a backup.

import { and, eq, isNull } from "drizzle-orm"
import {
  registryHostname,
  TRACKER_REGISTRY,
  type TrackerRegistryEntry,
} from "@/data/tracker-registry"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { PAUSE_RESET } from "@/lib/tracker-status"

const g = globalThis as typeof globalThis & { __registrySlugBackfilled?: boolean }

interface LinkRow {
  id: number
  baseUrl: string
  registrySlug: string | null
  isActive: boolean
  lastPolledAt: Date | null
}

interface LinkPlan {
  links: { id: number; entry: TrackerRegistryEntry }[]
  /** Rows on a listed host whose slug another row holds or won in this run. */
  blocked: { id: number; slug: string }[]
}

/** Registry entries keyed by host, from each url and each `previousHosts`. */
function registryByHostname(): Map<string, TrackerRegistryEntry> {
  const byHost = new Map<string, TrackerRegistryEntry>()
  for (const entry of TRACKER_REGISTRY) {
    for (const host of [registryHostname(entry.url), ...(entry.previousHosts ?? [])]) {
      // First entry wins. tracker-registry.test.ts forbids two entries on one
      // host, previous hosts included.
      if (host && !byHost.has(host)) byHost.set(host, entry)
    }
  }
  return byHost
}

/**
 * The entry a stored address belongs to, by its url host or a previous host.
 * The backfill links by it. The tracker list uses it only to name the tracker a
 * duplicate row would have been, and nothing sends a key or polls on it.
 */
export function registryEntryForStoredUrl(baseUrl: string): TrackerRegistryEntry | undefined {
  const host = registryHostname(baseUrl)
  return host ? registryByHostname().get(host) : undefined
}

// Active first, then the most recently polled, then the oldest.
function keeperOrder(a: LinkRow, b: LinkRow): number {
  return (
    Number(b.isActive) - Number(a.isActive) ||
    (b.lastPolledAt?.getTime() ?? 0) - (a.lastPolledAt?.getTime() ?? 0) ||
    a.id - b.id
  )
}

/**
 * Which rows with no slug to link, and to which entry. A slug another row holds,
 * archived or not, is never given out, and of several rows on one tracker only
 * the first in keeper order gets it.
 * @internal
 */
export function planRegistryLinks(rows: readonly LinkRow[]): LinkPlan {
  const held = new Set(rows.flatMap((row) => (row.registrySlug ? [row.registrySlug] : [])))
  const candidates = rows
    .flatMap((row) => {
      if (row.registrySlug) return []
      const entry = registryEntryForStoredUrl(row.baseUrl)
      return entry ? [{ row, entry }] : []
    })
    .sort((a, b) => keeperOrder(a.row, b.row))

  const plan: LinkPlan = { links: [], blocked: [] }
  for (const { row, entry } of candidates) {
    if (held.has(entry.slug)) {
      plan.blocked.push({ id: row.id, slug: entry.slug })
    } else {
      held.add(entry.slug)
      plan.links.push({ id: row.id, entry })
    }
  }
  return plan
}

/**
 * Links the rows planRegistryLinks picks and writes each one's copies from its
 * entry, as add and restore do. A row on a host the list doesn't carry is left
 * as it is, slug still null, and the poll pauses it.
 *
 * `force` skips the once-per-process latch, for rows written after boot.
 */
export async function backfillRegistrySlugs(options?: { force?: boolean }): Promise<void> {
  if (g.__registrySlugBackfilled && !options?.force) return

  try {
    // Every row, never the token. The slugs other rows hold come from this read.
    const rows = await db
      .select({
        id: trackers.id,
        baseUrl: trackers.baseUrl,
        registrySlug: trackers.registrySlug,
        isActive: trackers.isActive,
        lastPolledAt: trackers.lastPolledAt,
      })
      .from(trackers)

    const { links, blocked } = planRegistryLinks(rows)
    for (const { id, slug } of blocked) {
      log.debug({ trackerId: id, slug }, "Tracker left unlinked, another tracker holds its slug")
    }

    const now = new Date()
    let linked = 0
    for (const { id, entry } of links) {
      // Only while the slug is still null, so a link made since the select stands.
      // The row is now polled at its entry's address, so a pause or failures
      // from before no longer apply.
      const [written] = await db
        .update(trackers)
        .set({
          registrySlug: entry.slug,
          baseUrl: entry.url,
          apiPath: entry.apiPath,
          platformType: entry.platform,
          ...PAUSE_RESET,
          updatedAt: now,
        })
        .where(and(eq(trackers.id, id), isNull(trackers.registrySlug)))
        .returning({ id: trackers.id })
      if (written) {
        linked += 1
        log.debug({ trackerId: id, slug: entry.slug }, "Tracker linked to a registry entry")
      } else {
        log.debug(
          { trackerId: id, slug: entry.slug },
          "Tracker left unlinked, it was linked or deleted while the backfill ran"
        )
      }
    }

    g.__registrySlugBackfilled = true
    if (linked > 0) {
      const unlinked = rows.filter((row) => row.registrySlug === null).length
      log.info(
        { linked, left: unlinked - linked },
        "Linked trackers to the tracker list by their host"
      )
    }
  } catch (err) {
    // Deliberately left unlatched: a database that was not up yet gets another
    // attempt on the next boot, and until then a null-slug row is paused, not polled.
    log.warn(
      { error: errMsg(err) },
      "Registry slug backfill failed, rows it did not reach stay unlinked until the next start"
    )
  }
}
