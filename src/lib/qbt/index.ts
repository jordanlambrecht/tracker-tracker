// src/lib/qbt/index.ts

export { aggregateByTag } from "./aggregator"
export {
  buildBaseUrl,
  clearAllSessions,
  getSession,
  getTorrents,
  getTransferInfo,
  invalidateSession,
  login,
  parseCachedTorrents,
  syncMaindata,
  withSessionRetry,
} from "./client"
export type { SpeedSnapshot } from "./speed-cache"
export { clearSpeedCache, getSpeedSnapshots, pushSpeedSnapshot } from "./speed-cache"
export {
  applyMaindataUpdate,
  clearAllStores,
  getStoredTorrents,
  getStoreRevision,
  isStoreFresh,
  isStoreInitialized,
  resetStore,
} from "./sync-store"
export type {
  ClientStats,
  QbtMaindataResponse,
  QbtTorrent,
  QbtTransferInfo,
  TagStats,
} from "./types"
export { isQbtMaindataResponse } from "./types"
export { parseCrossSeedTags, stripSensitiveTorrentFields } from "./utils"
