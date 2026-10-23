// src/lib/tracker-platforms/index.ts

// Everything under tracker-platforms is server-side. The shapes a component
// needs live in @/types/tracker-stats and the vocabulary in
// @/data/platform-types, so importing this from a client file is a mistake
// this makes fail at build time rather than at runtime.
import "server-only"
import type { Agent as HttpAgent } from "node:http"
import { registryEntryFor } from "@/data/tracker-registry"
import { AvistazAdapter } from "./adapters/avistaz"
import { BtnAdapter } from "./adapters/btn"
import { C411Adapter } from "./adapters/c411"
import { DigitalCoreAdapter } from "./adapters/digitalcore"
import { FilelistAdapter } from "./adapters/filelist"
import { GazelleAdapter } from "./adapters/gazelle"
import { GGnAdapter } from "./adapters/ggn"
import { HawkeAdapter } from "./adapters/hawke"
import { IptorrentsAdapter } from "./adapters/iptorrents"
import { MamAdapter } from "./adapters/mam"
import { NebulanceAdapter } from "./adapters/nebulance"
import { RetrotoonAdapter } from "./adapters/retrotoon"
import { TorrentleechAdapter } from "./adapters/torrentleech"
import { Tr4kerAdapter } from "./adapters/tr4ker"
import { Unit3dAdapter } from "./adapters/unit3d"
import type { FetchOptions, FlareSolverrConfig, TrackerAdapter } from "./contract"

const adapters: Record<string, TrackerAdapter> = {
  avistaz: new AvistazAdapter(),
  btn: new BtnAdapter(),
  c411: new C411Adapter(),
  digitalcore: new DigitalCoreAdapter(),
  filelist: new FilelistAdapter(),
  gazelle: new GazelleAdapter(),
  ggn: new GGnAdapter(),
  hawke: new HawkeAdapter(),
  iptorrents: new IptorrentsAdapter(),
  mam: new MamAdapter(),
  nebulance: new NebulanceAdapter(),
  retrotoon: new RetrotoonAdapter(),
  torrentleech: new TorrentleechAdapter(),
  tr4ker: new Tr4kerAdapter(),
  unit3d: new Unit3dAdapter(),
}

export function getAdapter(platformType: string): TrackerAdapter {
  const adapter = adapters[platformType]
  if (!adapter) {
    throw new Error(`Unknown platform type: "${platformType}"`)
  }
  return adapter
}

/**
 * Resolve registry config plus caller-supplied infra options into one FetchOptions.
 * The registry entry comes from the row's slug; a row with none gets no registry
 * options and polls by its stored URL alone.
 */
export function buildFetchOptions(opts?: {
  registrySlug?: string | null
  proxyAgent?: HttpAgent
  remoteUserId?: number
  flaresolverr?: FlareSolverrConfig
}): FetchOptions {
  const fetchOptions: FetchOptions = {}
  // FlareSolverr makes the requests from its own browser, so it replaces the
  // proxy rather than going through it.
  if (opts?.flaresolverr) fetchOptions.flaresolverr = opts.flaresolverr
  else if (opts?.proxyAgent) fetchOptions.proxyAgent = opts.proxyAgent
  if (opts?.remoteUserId) fetchOptions.remoteUserId = opts.remoteUserId

  const entry = registryEntryFor({ registrySlug: opts?.registrySlug ?? null })
  if (entry?.gazelleAuthStyle) fetchOptions.authStyle = entry.gazelleAuthStyle
  if (entry?.gazelleEnrich) fetchOptions.enrich = true
  if (entry?.unit3dAuthStyle) fetchOptions.unit3dAuthStyle = entry.unit3dAuthStyle
  if (entry?.nebulanceAuthParam) fetchOptions.nebulanceAuthParam = entry.nebulanceAuthParam

  return fetchOptions
}

export type { FetchOptions, FlareSolverrConfig, TrackerAdapter } from "./contract"
