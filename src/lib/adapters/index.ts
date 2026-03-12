// src/lib/adapters/index.ts
//
// Functions: getAdapter
// Exports: DEFAULT_API_PATHS

import { GazelleAdapter } from "./gazelle"
import { GGnAdapter } from "./ggn"
import { NebulanceAdapter } from "./nebulance"
import type { TrackerAdapter } from "./types"
import { Unit3dAdapter } from "./unit3d"

export const DEFAULT_API_PATHS: Record<string, string> = {
  unit3d: "/api/user",
  gazelle: "/ajax.php",
  ggn: "/api.php",
  nebulance: "/api.php",
}

const adapters: Record<string, TrackerAdapter> = {
  gazelle: new GazelleAdapter(),
  ggn: new GGnAdapter(),
  nebulance: new NebulanceAdapter(),
  unit3d: new Unit3dAdapter(),
}

export function getAdapter(platformType: string): TrackerAdapter {
  const adapter = adapters[platformType]
  if (!adapter) {
    throw new Error(`Unknown platform type: "${platformType}"`)
  }
  return adapter
}

export type { FetchOptions, TrackerAdapter, TrackerStats } from "./types"
