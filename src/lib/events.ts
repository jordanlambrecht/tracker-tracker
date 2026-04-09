// src/lib/events.ts
//
// Functions: parseLogLine, sanitizeLogDetail, classifyLogEvent, pinoLevelToSeverity,
//            snapshotToEvent, backupToEvent, mergeAndSort, groupPollBatches

import { sanitizeNetworkError } from "@/lib/error-utils"
import { bytesToGiB, formatBytesNum, formatRatioDisplay } from "@/lib/formatters"

// ── Types ────────────────────────────────────────────────────────────────────

export const EVENT_CATEGORIES = ["polls", "auth", "settings", "backups", "errors"] as const
export type EventCategory = (typeof EVENT_CATEGORIES)[number]
export const EVENT_LEVELS = ["debug", "info", "warn", "error"] as const
export type EventLevel = (typeof EVENT_LEVELS)[number]

export interface SystemEvent {
  id: string
  timestamp: string // ISO 8601
  category: EventCategory
  level: EventLevel
  title: string
  detail: string | null
  trackerId: number | null
  trackerName: string | null
  source: "log" | "db"
  children?: SystemEvent[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const REDACT_IPV4_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
const REDACT_IPV6_REGEX = /(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}/g

function redactIps(s: string): string {
  return s.replace(REDACT_IPV4_REGEX, "[redacted]").replace(REDACT_IPV6_REGEX, "[redacted]")
}

/** Pino numeric levels → our severity */
function pinoLevelToSeverity(level: number): EventLevel {
  if (level >= 50) return "error" // error=50, fatal=60
  if (level >= 40) return "warn" // warn=40
  if (level >= 30) return "info" // info=30
  return "debug" // debug=20, trace=10
}

// Auth event discriminators from existing structured log calls
const AUTH_EVENTS = new Set([
  "login_success",
  "login_failed",
  "logout",
  "totp_verified",
  "totp_failed",
  "session_expired",
  "lockout_triggered",
])

// Backup event discriminators
const BACKUP_EVENTS = new Set([
  "restore_starting",
  "restore_completed",
  "restore_failed",
  "backup_created",
  "backup_pruned",
])

// Settings/CRUD route prefixes
const SETTINGS_ROUTES = [
  "PATCH /api/settings",
  "PATCH /api/trackers/[id]",
  "POST /api/trackers",
  "DELETE /api/trackers",
  "POST /api/clients",
  "PATCH /api/clients",
  "DELETE /api/clients",
]

// ── Classification ───────────────────────────────────────────────────────────

interface PinoLine {
  level: number
  time: number
  msg?: string
  event?: string
  route?: string
  trackerId?: number
  trackerName?: string
  ip?: string
  action?: string
  [key: string]: unknown
}

function classifyLogEvent(line: PinoLine): EventCategory {
  // Auth events identified by structured `event` field
  if (line.event && AUTH_EVENTS.has(line.event)) return "auth"

  // Backup events
  if (line.event && BACKUP_EVENTS.has(line.event)) return "backups"

  // Errors (level >= 50)
  if (line.level >= 50) return "errors"

  // Settings/CRUD routes
  if (line.route && SETTINGS_ROUTES.some((r) => line.route?.startsWith(r))) return "settings"

  // Poll-related (has trackerId or mentions poll)
  if (line.trackerId || (line.msg && /poll/i.test(line.msg))) return "polls"

  // Default: settings (system startup, config, etc.)
  return "settings"
}

// ── Sanitization ─────────────────────────────────────────────────────────────

function sanitizeLogDetail(line: PinoLine): string | null {
  const parts: string[] = []

  // Include action if present (e.g., "paused", "resumed")
  if (line.action) parts.push(String(line.action))

  // Include route context
  if (line.route) parts.push(String(line.route))

  // Include IP field — always redacted immediately
  if (line.ip && typeof line.ip === "string") {
    parts.push(`ip=[redacted]`)
  }

  // For warn+ lines, sanitize the message to strip raw error details
  if (line.level >= 40 && line.msg) {
    parts.push(sanitizeNetworkError(line.msg, redactIps(line.msg)))
  }

  // Redact any IP that leaked through from other fields
  const raw = parts.length > 0 ? parts.join(" — ") : null
  return raw ? redactIps(raw) : null
}

// ── Parser ───────────────────────────────────────────────────────────────────

export function parseLogLine(raw: string): SystemEvent | null {
  if (!raw.trim()) return null

  let line: PinoLine
  try {
    line = JSON.parse(raw) as PinoLine
  } catch {
    return null
  }

  // Must have at minimum: level, time, msg
  if (typeof line.level !== "number" || typeof line.time !== "number") return null
  if (!line.msg && !line.event) return null

  const category = classifyLogEvent(line)
  const severity = pinoLevelToSeverity(line.level)

  return {
    id: `log-${line.time}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(line.time).toISOString(),
    category,
    level: severity,
    title:
      line.level >= 40
        ? sanitizeNetworkError(
            line.msg ?? "Unknown event",
            redactIps(line.msg ?? line.event ?? "Unknown event")
          )
        : redactIps(line.msg ?? line.event ?? "Unknown event"),
    detail: sanitizeLogDetail(line),
    trackerId: typeof line.trackerId === "number" ? line.trackerId : null,
    trackerName: typeof line.trackerName === "string" ? line.trackerName : null,
    source: "log",
  }
}

// ── DB Event Converters ──────────────────────────────────────────────────────

interface SnapshotRow {
  id: number
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
  ratio: number | null
  trackerId: number
  trackerName: string | null
}

export function snapshotToEvent(row: SnapshotRow): SystemEvent {
  let upGib = "0.0"
  let downGib = "0.0"
  try {
    upGib = bytesToGiB(row.uploadedBytes).toFixed(1)
    downGib = bytesToGiB(row.downloadedBytes).toFixed(1)
  } catch {
    // Non-numeric byte strings default to 0
  }
  const ratioStr = row.ratio !== null ? formatRatioDisplay(row.ratio) : ""

  return {
    id: `snap-${row.id}`,
    timestamp: row.polledAt,
    category: "polls",
    level: "info",
    title: "Poll succeeded",
    detail: [row.trackerName, `↑ ${upGib} GiB`, `↓ ${downGib} GiB`, ratioStr]
      .filter(Boolean)
      .join(" — "),
    trackerId: row.trackerId,
    trackerName: row.trackerName ?? null,
    source: "db",
  }
}

interface BackupRow {
  id: number
  createdAt: string
  sizeBytes: number
  encrypted: boolean
  status: string
  frequency: string | null
}

export function backupToEvent(row: BackupRow): SystemEvent {
  const isError = row.status === "failed"

  return {
    id: `backup-${row.id}`,
    timestamp: row.createdAt,
    category: "backups",
    level: isError ? "error" : "info",
    title: `Backup ${row.status}`,
    detail: [row.frequency, row.encrypted ? "encrypted" : null, formatBytesNum(row.sizeBytes)]
      .filter(Boolean)
      .join(" — "),
    trackerId: null,
    trackerName: null,
    source: "db",
  }
}

// ── Merge & Sort ─────────────────────────────────────────────────────────────

export function mergeAndSort(
  dbEvents: SystemEvent[],
  logEvents: SystemEvent[],
  category: EventCategory | "all" = "all",
  limit = 50,
  offset = 0
): SystemEvent[] {
  let combined = [...dbEvents, ...logEvents]

  // Filter by category
  if (category !== "all") {
    combined = combined.filter((e) => e.category === category)
  }

  // Sort reverse chronological
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Paginate
  return combined.slice(offset, offset + limit)
}

// ── Batch Grouping ──────────────────────────────────────────────────────────

/**
 * Collapses consecutive "Poll succeeded" events that share the same timestamp
 * (from a single scheduler batch) into a single parent event with children.
 * Non-poll events and lone polls pass through unchanged.
 */
export function groupPollBatches(events: SystemEvent[]): SystemEvent[] {
  const result: SystemEvent[] = []

  let i = 0
  while (i < events.length) {
    const event = events[i]

    if (event.category !== "polls" || event.title !== "Poll succeeded") {
      result.push(event)
      i++
      continue
    }

    // Collect consecutive poll-succeeded events with the same timestamp
    const batch: SystemEvent[] = [event]
    let j = i + 1
    while (
      j < events.length &&
      events[j].category === "polls" &&
      events[j].title === "Poll succeeded" &&
      events[j].timestamp === event.timestamp
    ) {
      batch.push(events[j])
      j++
    }

    if (batch.length === 1) {
      result.push(event)
    } else {
      const names = batch.map((e) => e.trackerName ?? "Unknown").join(", ")
      result.push({
        id: `batch-${event.timestamp}`,
        timestamp: event.timestamp,
        category: "polls",
        level: "info",
        title: `Poll succeeded for ${batch.length} trackers`,
        detail: names,
        trackerId: null,
        trackerName: null,
        source: "db",
        children: batch,
      })
    }

    i = j
  }

  return result
}
