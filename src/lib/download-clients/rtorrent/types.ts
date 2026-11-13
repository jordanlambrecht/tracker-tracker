// src/lib/download-clients/rtorrent/types.ts
//
// Functions:
//   rowToTorrent    - One d.multicall2 row as an RtorrentTorrent, or null when its shape is wrong
//   rowToTracker    - One t.multicall row as an RtorrentTracker, or null when its shape is wrong

import type { XmlRpcValue } from "./xmlrpc"

export interface RtorrentTracker {
  url: string
  group: number
  enabled: boolean
  scrapeComplete: number
  scrapeIncomplete: number
}

export interface RtorrentTorrent {
  hash: string
  name: string
  /** d.custom1, where ruTorrent and the *arr apps keep the label, percent-encoded. */
  label: string
  /** 1 started, 0 stopped. */
  state: number
  isActive: boolean
  isOpen: boolean
  complete: boolean
  /** 0 idle, 1 first check, 2 on completion, 3 rehash. */
  hashing: number
  upRate: number
  downRate: number
  upTotal: number
  downTotal: number
  /** Uploaded over completed bytes, times 1000. */
  ratio: number
  sizeBytes: number
  leftBytes: number
  completedBytes: number
  peersComplete: number
  peersAccounted: number
  startedAt: number
  finishedAt: number
  /** ruTorrent's add time as a unix timestamp string, "" when ruTorrent never saw it. */
  addTime: string
  directory: string
  basePath: string
  isMultiFile: boolean
  isPrivate: boolean
  trackers: RtorrentTracker[]
}

type FieldKind = "string" | "number" | "bool"

type ScalarKey = Exclude<keyof RtorrentTorrent, "trackers">

/** The d.multicall2 commands, in row order, and the key each fills. */
const FIELD_SPEC: readonly (readonly [string, ScalarKey, FieldKind])[] = [
  ["d.hash=", "hash", "string"],
  ["d.name=", "name", "string"],
  ["d.custom1=", "label", "string"],
  ["d.state=", "state", "number"],
  ["d.is_active=", "isActive", "bool"],
  ["d.is_open=", "isOpen", "bool"],
  ["d.complete=", "complete", "bool"],
  ["d.hashing=", "hashing", "number"],
  ["d.up.rate=", "upRate", "number"],
  ["d.down.rate=", "downRate", "number"],
  ["d.up.total=", "upTotal", "number"],
  ["d.down.total=", "downTotal", "number"],
  ["d.ratio=", "ratio", "number"],
  ["d.size_bytes=", "sizeBytes", "number"],
  ["d.left_bytes=", "leftBytes", "number"],
  ["d.completed_bytes=", "completedBytes", "number"],
  ["d.peers_complete=", "peersComplete", "number"],
  ["d.peers_accounted=", "peersAccounted", "number"],
  ["d.timestamp.started=", "startedAt", "number"],
  ["d.timestamp.finished=", "finishedAt", "number"],
  ["d.custom=addtime", "addTime", "string"],
  ["d.directory=", "directory", "string"],
  ["d.base_path=", "basePath", "string"],
  ["d.is_multi_file=", "isMultiFile", "bool"],
  ["d.is_private=", "isPrivate", "bool"],
]

export const RTORRENT_FIELDS: readonly string[] = FIELD_SPEC.map(([command]) => command)

/** The t.multicall commands, in the order rowToTracker reads them. */
export const TRACKER_FIELDS = [
  "t.url=",
  "t.group=",
  "t.is_enabled=",
  "t.scrape_complete=",
  "t.scrape_incomplete=",
] as const

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x)
}

export function rowToTorrent(row: XmlRpcValue): RtorrentTorrent | null {
  if (!Array.isArray(row) || row.length !== FIELD_SPEC.length) return null
  const out: Record<string, unknown> = { trackers: [] }
  for (const [i, [, key, kind]] of FIELD_SPEC.entries()) {
    const value = row[i]
    if (kind === "string") {
      if (typeof value !== "string") return null
      out[key] = value
    } else if (kind === "number") {
      if (!isNumber(value)) return null
      out[key] = value
    } else {
      // rTorrent sends its booleans as integers.
      if (!isNumber(value) && typeof value !== "boolean") return null
      out[key] = value === true || value === 1
    }
  }
  return out as unknown as RtorrentTorrent
}

export function rowToTracker(row: XmlRpcValue): RtorrentTracker | null {
  if (!Array.isArray(row) || row.length !== TRACKER_FIELDS.length) return null
  const [url, group, enabled, complete, incomplete] = row
  if (typeof url !== "string" || !isNumber(group) || !isNumber(complete) || !isNumber(incomplete)) {
    return null
  }
  if (!isNumber(enabled) && typeof enabled !== "boolean") return null
  return {
    url,
    group,
    enabled: enabled === true || enabled === 1,
    scrapeComplete: complete,
    scrapeIncomplete: incomplete,
  }
}
