// src/lib/adapters/index.ts
//
// Functions: getAdapter
import type { TrackerAdapter } from "./types"
import { Unit3dAdapter } from "./unit3d"

const adapters: Record<string, TrackerAdapter> = {
  unit3d: new Unit3dAdapter(),
}

export function getAdapter(platformType: string): TrackerAdapter {
  const adapter = adapters[platformType]
  if (!adapter) {
    throw new Error(`Unknown platform type: "${platformType}"`)
  }
  return adapter
}

export type { TrackerAdapter, TrackerStats } from "./types"
