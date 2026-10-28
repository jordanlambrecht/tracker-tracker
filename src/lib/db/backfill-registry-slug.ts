// src/lib/db/backfill-registry-slug.ts
//
// One-time repair for tracker rows created before trackers.registry_slug
// existed. Called once per server start, next to the scheduler recovery, and
// idempotent, so after the first boot on the new schema it costs one query. A
// restore calls it again, forced, for the rows an older backup brings back.

import { eq, isNull } from "drizzle-orm"
import {
  registryHostname,
  TRACKER_REGISTRY,
  type TrackerRegistryEntry,
} from "@/data/tracker-registry"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"

const g = globalThis as typeof globalThis & { __registrySlugBackfilled?: boolean }

/** Registry entries keyed by the hostname a stored URL reduces to. */
function registryByHostname(): Map<string, TrackerRegistryEntry> {
  const byHost = new Map<string, TrackerRegistryEntry>()
  for (const entry of TRACKER_REGISTRY) {
    const host = registryHostname(entry.url)
    // First entry wins. Two entries on one hostname is exactly what the
    // no-two-hostnames test in tracker-registry.test.ts forbids.
    if (host && !byHost.has(host)) byHost.set(host, entry)
  }
  return byHost
}

/**
 * Names the registry entry of every tracker row that predates the slug column,
 * by matching the stored URL's hostname against the registry, and rewrites that
 * row's URL to the registry spelling when the two differ.
 *
 * A row on a host the registry does not carry is a custom site, not a mistake:
 * it is left exactly as it is, slug still null, and keeps polling its own URL.
 *
 * `force` skips the once-per-process latch, for rows written after boot.
 */
export async function backfillRegistrySlugs(options?: { force?: boolean }): Promise<void> {
  if (g.__registrySlugBackfilled && !options?.force) return

  try {
    // Three columns, never the token: nothing here needs a credential.
    const rows = await db
      .select({
        id: trackers.id,
        baseUrl: trackers.baseUrl,
        registrySlug: trackers.registrySlug,
      })
      .from(trackers)
      .where(isNull(trackers.registrySlug))

    // Nothing to name, so nothing to report: this is every boot after the
    // first one, and a count line of three zeroes would be pure noise.
    if (rows.length === 0) {
      g.__registrySlugBackfilled = true
      return
    }

    const byHost = registryByHostname()
    let matched = 0
    let normalised = 0

    for (const row of rows) {
      const host = registryHostname(row.baseUrl)
      const entry = host ? byHost.get(host) : undefined
      if (!entry) continue

      const values: { registrySlug: string; baseUrl?: string } = { registrySlug: entry.slug }
      if (row.baseUrl !== entry.url) {
        values.baseUrl = entry.url
        normalised += 1
      }
      await db.update(trackers).set(values).where(eq(trackers.id, row.id))
      matched += 1
      log.debug({ trackerId: row.id, slug: entry.slug }, "Tracker matched to a registry entry")
    }

    g.__registrySlugBackfilled = true
    log.info(
      { matched, normalised, left: rows.length - matched },
      "Backfilled the registry slug on tracker rows that predate the column"
    )
  } catch (err) {
    // Deliberately left unlatched: a database that was not up yet gets another
    // attempt on the next boot, and until then a null-slug row polls its stored URL.
    log.warn({ error: errMsg(err) }, "Registry slug backfill failed, rows keep their stored URL")
  }
}
