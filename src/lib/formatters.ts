// src/lib/formatters.ts
//
// Functions: formatBytesFromString, bytesToGiB, formatBytesNum,
// formatRatio, formatAccountAge, formatJoinedDate, formatStatValue,
// formatDuration, formatTimeAgo, splitValueUnit,
// localDateStr, formatSpeed,
// formatRatioDisplay, formatCount, formatPercent, formatDateTime

import type { TrackerLatestStats } from "@/types/api"

/**
 * Formats a bigint byte string (from API) to human-readable GiB/TiB.
 * Returns "—" for null/undefined/empty values.
 */
export function formatBytesFromString(bytesStr: string | null | undefined): string {
  if (!bytesStr) return "—"
  try {
    const bytes = Number(BigInt(bytesStr))
    const tib = bytes / 1024 ** 4
    if (tib >= 1) return `${tib.toFixed(2)} TiB`
    const gib = bytes / 1024 ** 3
    if (gib >= 1) return `${gib.toFixed(2)} GiB`
    const mib = bytes / 1024 ** 2
    return `${Math.round(mib)} MiB`
  } catch {
    return "—"
  }
}

/**
 * Converts a bigint byte string to GiB as a number (for chart data).
 * Returns 0 for null, undefined, or empty string.
 */
export function bytesToGiB(bytesStr: string | null | undefined): number {
  if (!bytesStr) return 0
  try {
    return Number(BigInt(bytesStr)) / 1024 ** 3
  } catch {
    return 0
  }
}

/**
 * Formats a JS number of bytes into a human-readable string with auto-scaling.
 * Uses binary units (KiB, MiB, GiB, TiB, PiB) by default, or decimal (KB, MB, GB, TB, PB)
 * when binary is false. Handles negative values (i.e negative buffer).
 * Adaptive precision: 0dp for ≥100, 1dp for ≥10, 2dp for <10.
 */
export function formatBytesNum(bytes: number, binary = true): string {
  if (!Number.isFinite(bytes)) return "—"
  if (bytes === 0) return "0 B"
  const sign = bytes < 0 ? "-" : ""
  const abs = Math.abs(bytes)
  const k = binary ? 1024 : 1000
  const units = binary
    ? ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]
    : ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.min(Math.floor(Math.log(abs) / Math.log(k)), units.length - 1)
  const val = abs / k ** i
  return `${sign}${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`
}

/**
 * Formats a ratio number to 2 decimal places.
 * Returns "—" for null/undefined.
 */
export function formatRatio(ratio: number | null | undefined, suffix = ""): string {
  if (ratio === null || ratio === undefined) return "—"
  if (!Number.isFinite(ratio)) return `∞${suffix}`
  return `${ratio.toFixed(2)}${suffix}`
}

/**
 * Formats a joinedAt date string (YYYY-MM-DD) into a relative duration.
 * Returns "2 years, 3 months", "5 months", "12 days", etc.
 * Returns null if joinedAt is null.
 */
export function formatAccountAge(joinedAt: string | null): string | null {
  if (!joinedAt) return null
  const joined = new Date(joinedAt)
  const now = new Date()
  const diffMs = now.getTime() - joined.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`
  const months = Math.floor(days / 30)
  if (months < 12) {
    return `${months} month${months !== 1 ? "s" : ""}`
  }
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths > 0) {
    return `${years} year${years !== 1 ? "s" : ""}, ${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`
  }
  return `${years} year${years !== 1 ? "s" : ""}`
}

/**
 * Formats a joinedAt date string (YYYY-MM-DD) into a human-readable date.
 * Returns "March 9, 2026" format. Returns null if joinedAt is null.
 */
export function formatJoinedDate(joinedAt: string | null): string | null {
  if (!joinedAt) return null
  const date = new Date(`${joinedAt}T00:00:00`)
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

export type StatMode = "ratio" | "seeding" | "uploaded" | "downloaded" | "buffer"

/**
 * Formats a stat value from TrackerLatestStats for display in the sidebar.
 * Returns "—" when stats are null or the requested field is missing.
 */
export function formatStatValue(stats: TrackerLatestStats | null, mode: StatMode): string {
  if (!stats) return "—"

  switch (mode) {
    case "ratio":
      return formatRatioDisplay(stats.ratio)
    case "seeding":
      return stats.seedingCount !== null && stats.seedingCount !== undefined
        ? `${formatCount(stats.seedingCount)} seeding`
        : "—"
    case "uploaded":
      return stats.uploadedBytes ? `${formatBytesFromString(stats.uploadedBytes)} ↑` : "—"
    case "downloaded":
      return stats.downloadedBytes ? `${formatBytesFromString(stats.downloadedBytes)} ↓` : "—"
    case "buffer": {
      if (!stats.uploadedBytes || !stats.downloadedBytes) return "—"
      const up = BigInt(stats.uploadedBytes)
      const down = BigInt(stats.downloadedBytes)
      const buf = up - down
      return `${formatBytesFromString(buf.toString())} buf`
    }
  }
}

/**
 * Formats a duration in seconds to a compact human-readable string.
 * i.e 90 → "1m", 7200 → "2.0h", 172800 → "2.0d"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

/**
 * Formats a Date or ISO string as a compact relative time, i.e "just now", "5m ago", "3h ago", "2d ago".
 */
export function formatTimeAgo(dateOrIso: Date | string): string {
  const ms = typeof dateOrIso === "string" ? new Date(dateOrIso).getTime() : dateOrIso.getTime()
  if (Number.isNaN(ms)) return "—"
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Splits a formatted "123.45 GiB" string into { num, unit } for two-line StatCard rendering.
 */
export function splitValueUnit(formatted: string): { num: string; unit: string } {
  const idx = formatted.indexOf(" ")
  if (idx === -1) return { num: formatted, unit: "" }
  return { num: formatted.slice(0, idx), unit: formatted.slice(idx + 1) }
}

/**
 * Returns a YYYY-MM-DD date string in the server's local timezone (respects TZ env).
 */
export function localDateStr(date?: Date | number): string {
  const d = date instanceof Date ? date : date !== undefined ? new Date(date) : new Date()
  return d.toLocaleDateString("en-CA")
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 B/s"
  return `${formatBytesNum(bytesPerSec)}/s`
}

/** Formats a ratio with "x" suffix for display. Returns "—" for null/undefined, "∞x" for Infinity. */
export function formatRatioDisplay(ratio: number | null | undefined): string {
  return formatRatio(ratio, "x")
}

/** Formats an integer with locale-aware thousand separators. Returns "—" for null/undefined. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  return n.toLocaleString("en-US")
}

/** Formats a percentage value with configurable decimal places. */
export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—"
  return `${value.toFixed(decimals)}%`
}

/** Formats a Date, ISO string, or timestamp as a locale-pinned datetime string. */
export function formatDateTime(dateOrIso: Date | string | number): string {
  const d =
    typeof dateOrIso === "string" || typeof dateOrIso === "number" ? new Date(dateOrIso) : dateOrIso
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US")
}
