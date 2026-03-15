// src/lib/qbt/index.ts

export { aggregateByTag, filterAndDedup } from "./aggregator"
export { buildBaseUrl, clearAllSessions, getSession, getTorrents, getTransferInfo, invalidateSession, login, withSessionRetry } from "./client"
export type { SpeedSnapshot } from "./speed-cache"
export { clearSpeedCache, getSpeedSnapshots, pushSpeedSnapshot } from "./speed-cache"
export type { ClientStats, QbtTorrent, QbtTransferInfo, TagStats } from "./types"
export { parseCrossSeedTags, stripSensitiveTorrentFields } from "./utils"
