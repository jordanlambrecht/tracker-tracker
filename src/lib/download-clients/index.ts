// src/lib/download-clients/index.ts

export { QbtClientAdapter } from "./adapters/qbt"
export { aggregateByTag } from "./aggregator"
export type { FleetAggregationResponse } from "./coordinator"
export {
  fetchFleetAggregation,
  fetchFleetTorrents,
  fetchTrackerTorrents,
  fetchTrackerTorrentsCached,
  testClientConnection,
} from "./coordinator"
export { CLIENT_CONNECTION_COLUMNS, decryptClientCredentials } from "./credentials"
export { createAdapterForClient } from "./factory"
export type { MergedResult } from "./fetch"
export { fetchAndMergeTorrents, stripSensitiveTorrentFields } from "./fetch"
export { mapQbtDelta, mapQbtTorrent } from "./field-map"
export type { RawTorrent } from "./merge"
export { aggregateCrossSeedTags, mergeTorrentLists, stampClientNames } from "./merge"
export { clearAllSessions, parseCachedTorrents } from "./qbt/transport"
export type { ClientStats, TagStats } from "./qbt/types"
export type { SpeedSnapshot } from "./speed-cache"
export { clearSpeedCache, getSpeedSnapshots, pushSpeedSnapshot } from "./speed-cache"
export {
  applyMaindataUpdate,
  clearAllStores,
  getFilteredTorrents,
  getStoredTorrents,
  getStoreRevision,
  isStoreFresh,
  isStoreInitialized,
  replaceStoreTorrents,
  resetStore,
  STORE_MAX_AGE_MS,
} from "./sync-store"
export type { SlimTorrent } from "./transforms"
export { slimTorrentForCache } from "./transforms"
export type {
  ClientAdapter,
  ClientType,
  DeltaSyncResponse,
  TorrentRecord,
  TransferStats,
} from "./types"
export { assertClientType, VALID_CLIENT_TYPES } from "./types"
