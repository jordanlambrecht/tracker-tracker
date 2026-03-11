// src/lib/qbt/speed-cache.ts
//
// Available functions:
//   pushSpeedSnapshot  - Append a speed sample for a client, trimming to MAX_ENTRIES
//   getSpeedSnapshots  - Return the speed history array for a client (empty if none)
//   clearSpeedCache    - Wipe all in-memory speed data (called on logout)

const MAX_ENTRIES = 60

export interface SpeedSnapshot {
  timestamp: number
  uploadSpeed: number
  downloadSpeed: number
}

const g = globalThis as typeof globalThis & {
  __qbtSpeedCache?: Map<number, SpeedSnapshot[]>
}
if (!g.__qbtSpeedCache) g.__qbtSpeedCache = new Map()
const speedCache = g.__qbtSpeedCache

export function pushSpeedSnapshot(clientId: number, up: number, down: number): void {
  const existing = speedCache.get(clientId) ?? []
  existing.push({ timestamp: Date.now(), uploadSpeed: up, downloadSpeed: down })
  if (existing.length > MAX_ENTRIES) {
    existing.splice(0, existing.length - MAX_ENTRIES)
  }
  speedCache.set(clientId, existing)
}

export function getSpeedSnapshots(clientId: number): SpeedSnapshot[] {
  return speedCache.get(clientId) ?? []
}

export function clearSpeedCache(): void {
  speedCache.clear()
}
