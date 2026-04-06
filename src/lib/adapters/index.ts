// src/lib/adapters/index.ts

import type { Agent as HttpAgent } from "node:http"
import { findRegistryEntry } from "@/data/tracker-registry"
import { AvistazAdapter } from "./avistaz"
import { GazelleAdapter } from "./gazelle"
import { GGnAdapter } from "./ggn"
import { MamAdapter } from "./mam"
import { NebulanceAdapter } from "./nebulance"
import type { FetchOptions, TrackerAdapter } from "./types"
import { Unit3dAdapter } from "./unit3d"

export type { PlatformType } from "./constants"
export { DEFAULT_API_PATHS, VALID_PLATFORM_TYPES } from "./constants"

const adapters: Record<string, TrackerAdapter> = {
  avistaz: new AvistazAdapter(),
  gazelle: new GazelleAdapter(),
  ggn: new GGnAdapter(),
  mam: new MamAdapter(),
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

/** Resolve registry config + caller-supplied infra options into a unified FetchOptions. */
export function buildFetchOptions(
  baseUrl: string,
  opts?: { proxyAgent?: HttpAgent; remoteUserId?: number }
): FetchOptions {
  const fetchOptions: FetchOptions = {}
  if (opts?.proxyAgent) fetchOptions.proxyAgent = opts.proxyAgent
  if (opts?.remoteUserId) fetchOptions.remoteUserId = opts.remoteUserId

  const entry = findRegistryEntry(baseUrl)
  if (entry?.gazelleAuthStyle) fetchOptions.authStyle = entry.gazelleAuthStyle
  if (entry?.gazelleEnrich) fetchOptions.enrich = true
  if (entry?.unit3dAuthStyle) fetchOptions.unit3dAuthStyle = entry.unit3dAuthStyle

  return fetchOptions
}

export type {
  FetchOptions,
  GazelleAuthStyle,
  TrackerAdapter,
  TrackerStats,
  Unit3dAuthStyle,
} from "./types"
