// src/lib/download-clients/sync-store.ts
//
// Functions:
//   applyMaindataUpdate    - Merge a maindata delta (or full update) into the store,
//                            reporting a refusal when the update would exceed the cap
//   getStoredTorrents      - Return a snapshot array of all torrents for a client
//   getFilteredTorrents    - Copy + filter in one pass (avoids copying irrelevant torrents)
//   getStoreRevision       - Return the current rid for a client (0 if uninitialized)
//   isStoreInitialized     - Whether the store has received at least one fullUpdate
//   isStoreFresh           - Whether the store is initialized and updated within a max age
//   resetStore             - Clear a single client's store (forces rid=0 on next sync)
//   clearAllStores         - Clear all stores (called on logout/scheduler stop)
//   replaceStoreTorrents   - Replace all torrents for a client (for non-delta-sync clients)

import { SYNC_STORE_MAX_TORRENTS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { coerceRequiredNumeric, coerceRequiredString, dropMistypedDeltaFields } from "./field-map"
import type { DeltaSyncResponse, TorrentRecord } from "./types"

/** How long a sync store entry is considered fresh */
export const STORE_MAX_AGE_MS = 10 * 60 * 1000

interface TorrentStore {
  rid: number
  torrents: Map<string, TorrentRecord>
  lastUpdatedAt: number
  initialized: boolean
}

const g = globalThis as typeof globalThis & {
  __qbtTorrentStores?: Map<string, TorrentStore>
}
if (!g.__qbtTorrentStores) g.__qbtTorrentStores = new Map()
const stores = g.__qbtTorrentStores

function getOrCreateStore(baseUrl: string): TorrentStore {
  let store = stores.get(baseUrl)
  if (!store) {
    store = { rid: 0, torrents: new Map(), lastUpdatedAt: 0, initialized: false }
    stores.set(baseUrl, store)
  }
  return store
}

// Checks a value for the TorrentRecord shape (key fields only).
// Used to validate new torrents before inserting into the store.
function isTorrentRecord(value: unknown): value is TorrentRecord {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return (
    typeof t.hash === "string" &&
    typeof t.name === "string" &&
    typeof t.state === "string" &&
    typeof t.size === "number" &&
    typeof t.ratio === "number"
  )
}

/** Reported by applyMaindataUpdate when the cap refused the whole update. */
export interface MaindataUpdateRefusal {
  held: number
  projected: number
  cap: number
}

/**
 * The size the store would end at, counting only what changes it: a hash it
 * already holds cannot grow it however often the delta names it, and a removal
 * shrinks it only for a hash it holds, once, however often the host repeats it.
 */
function projectedSize(store: TorrentStore, data: DeltaSyncResponse): number {
  // A fullUpdate clears the store before merging, so nothing it holds counts.
  if (data.fullUpdate) return Object.keys(data.torrents ?? {}).length

  let size = store.torrents.size
  for (const hash of Object.keys(data.torrents ?? {})) {
    if (!store.torrents.has(hash)) size++
  }
  for (const hash of new Set(data.torrentsRemoved)) {
    if (store.torrents.has(hash)) size--
  }
  return size
}

export function applyMaindataUpdate(
  baseUrl: string,
  data: DeltaSyncResponse
): MaindataUpdateRefusal | undefined {
  const store = getOrCreateStore(baseUrl)

  // Counted before anything is mutated, and before a fullUpdate clears the
  // store: clearing first and then refusing would hand the host a way to empty
  // it. Returned rather than swallowed, because the store still holds the
  // previous poll and a caller that reads it now files stale figures as fresh.
  const projected = projectedSize(store, data)
  if (projected > SYNC_STORE_MAX_TORRENTS) {
    const refusal = { held: store.torrents.size, projected, cap: SYNC_STORE_MAX_TORRENTS }
    log.warn(
      { baseUrl, ...refusal },
      "sync-store: refused an update that would exceed the torrent cap"
    )
    return refusal
  }

  if (data.fullUpdate) {
    store.torrents.clear()
    store.initialized = true
  }

  if (data.torrents) {
    for (const [hash, partial] of Object.entries(data.torrents)) {
      const existing = store.torrents.get(hash)
      if (existing) {
        // The store outlives the poll and is serialized into cachedTorrents,
        // so a bad value merged here stays. A mistyped field is dropped and the
        // stored one kept; the merge is then validated like an insert, and the
        // previous record survives a failure.
        const merged: Record<string, unknown> = {
          ...existing,
          ...dropMistypedDeltaFields(partial),
          hash,
        }
        coerceRequiredNumeric(merged)
        coerceRequiredString(merged)
        if (isTorrentRecord(merged)) {
          store.torrents.set(hash, merged as TorrentRecord)
        } else {
          log.warn(
            { hash, keys: Object.keys(partial) },
            "sync-store: dropped delta, failed shape check"
          )
        }
      } else {
        // New torrent. This path skips mapQbtTorrent, so missing numerics are
        // coerced to 0 here, matching the full-list path. Only the string
        // fields (hash, name, state) still gate insertion.
        const candidate: Record<string, unknown> = { ...partial, hash }
        coerceRequiredNumeric(candidate)
        coerceRequiredString(candidate)
        if (isTorrentRecord(candidate)) {
          store.torrents.set(hash, candidate as TorrentRecord)
        } else {
          log.warn(
            { hash, keys: Object.keys(partial) },
            "sync-store: dropped new torrent, failed shape check"
          )
        }
      }
    }
  }

  if (data.torrentsRemoved) {
    for (const hash of data.torrentsRemoved) {
      store.torrents.delete(hash)
    }
  }

  store.rid = data.rid
  store.lastUpdatedAt = Date.now()
}

export function getStoredTorrents(baseUrl: string): TorrentRecord[] {
  const store = stores.get(baseUrl)
  if (!store?.initialized) return []
  return Array.from(store.torrents.values(), (t) => ({ ...t }))
}

// Copy + filter in one pass. Only copies torrents matching the predicate.
export function getFilteredTorrents(
  baseUrl: string,
  predicate: (torrent: TorrentRecord) => boolean
): TorrentRecord[] {
  const store = stores.get(baseUrl)
  if (!store?.initialized) return []
  const result: TorrentRecord[] = []
  for (const t of store.torrents.values()) {
    if (predicate(t)) result.push({ ...t })
  }
  return result
}

export function getStoreRevision(baseUrl: string): number {
  return stores.get(baseUrl)?.rid ?? 0
}

export function isStoreInitialized(baseUrl: string): boolean {
  return stores.get(baseUrl)?.initialized ?? false
}

/** Returns true if the store is initialized and was updated within the given max age (ms). */
export function isStoreFresh(baseUrl: string, maxAgeMs: number): boolean {
  const store = stores.get(baseUrl)
  if (!store?.initialized) return false
  return Date.now() - store.lastUpdatedAt <= maxAgeMs
}

export function resetStore(baseUrl: string): void {
  const store = stores.get(baseUrl)
  if (store) {
    store.rid = 0
    store.torrents.clear()
    store.initialized = false
    store.lastUpdatedAt = 0
  }
}

export function clearAllStores(): void {
  stores.clear()
}

export function replaceStoreTorrents(baseUrl: string, torrents: TorrentRecord[]): void {
  const store = getOrCreateStore(baseUrl)
  store.torrents.clear()
  for (const t of torrents) {
    store.torrents.set(t.hash, t)
  }
  store.initialized = true
  store.lastUpdatedAt = Date.now()
}
