// src/lib/qbt/sync-store.ts
//
// Functions:
//   applyMaindataUpdate  - Merge a maindata delta (or full update) into the store
//   getStoredTorrents    - Return a snapshot array of all torrents for a client
//   getStoreRevision     - Return the current rid for a client (0 if uninitialized)
//   isStoreInitialized   - Whether the store has received at least one full_update
//   isStoreFresh         - Whether the store is initialized and updated within a max age
//   resetStore           - Clear a single client's store (forces rid=0 on next sync)
//   clearAllStores       - Clear all stores (called on logout/scheduler stop)

import { isQbtTorrent, type QbtMaindataResponse, type QbtTorrent } from "./types"

interface TorrentStore {
  rid: number
  torrents: Map<string, QbtTorrent>
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

export function applyMaindataUpdate(baseUrl: string, data: QbtMaindataResponse): void {
  const store = getOrCreateStore(baseUrl)

  if (data.full_update) {
    store.torrents.clear()
    store.initialized = true
  }

  if (data.torrents) {
    for (const [hash, partial] of Object.entries(data.torrents)) {
      const existing = store.torrents.get(hash)
      if (existing) {
        Object.assign(existing, partial)
      } else {
        // New torrent — validate it has required fields before inserting.
        // qBT sends all fields for new torrents, but guard against partials.
        const candidate = { ...partial, hash }
        if (isQbtTorrent(candidate)) {
          store.torrents.set(hash, candidate as QbtTorrent)
        }
      }
    }
  }

  if (data.torrents_removed) {
    for (const hash of data.torrents_removed) {
      store.torrents.delete(hash)
    }
  }

  store.rid = data.rid
  store.lastUpdatedAt = Date.now()
}

export function getStoredTorrents(baseUrl: string): QbtTorrent[] {
  const store = stores.get(baseUrl)
  if (!store?.initialized) return []
  return Array.from(store.torrents.values(), (t) => ({ ...t }))
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
