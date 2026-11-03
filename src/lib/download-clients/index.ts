// src/lib/download-clients/index.ts

export { aggregateByTag } from "./aggregator"
export {
  fetchFleetAggregation,
  fetchFleetTorrents,
  fetchTrackerTorrents,
  fetchTrackerTorrentsCached,
  testClientConnection,
} from "./coordinator"
export { CLIENT_CONNECTION_COLUMNS } from "./credentials"
export { createAdapterForClient, disposeClient } from "./factory"
export { stripSensitiveTorrentFields } from "./fetch"
export { clearAllSessions, parseCachedTorrents } from "./qbt/transport"
export { clearSpeedCache, getSpeedSnapshots, pushSpeedSnapshot } from "./speed-cache"
export {
  applyMaindataUpdate,
  getFilteredTorrents,
  getStoreRevision,
  isStoreInitialized,
  replaceStoreTorrents,
} from "./sync-store"
export { slimTorrentForCache } from "./transforms"
export type { AuthMethod, ClientType } from "./types"
export { DEFAULT_CLIENT_PORTS, VALID_CLIENT_TYPES } from "./types"
