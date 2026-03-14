// src/lib/formatters.ts
//
// Functions: formatBytesFromString, bytesToGiB, formatBytesFromNumber, formatBytesNum, formatRatio, formatAccountAge, formatJoinedDate, hexToRgba, hexToHsl, hslToHex, generatePalette, getComplementaryColor, formatStatValue, computeDelta, formatDuration, formatTimeAgo, splitValueUnit

import type { Snapshot, TrackerLatestStats } from "@/types/api"

/**
 * Formats a bigint byte string (from API) to human-readable GiB/TiB.
 * Returns "—" for null/undefined/empty values.
 */
export function formatBytesFromString(bytesStr: string | null | undefined): string {
  if (!bytesStr) return "—"
  const bytes = Number(BigInt(bytesStr))
  const tib = bytes / 1024 ** 4
  if (tib >= 1) return `${tib.toFixed(2)} TiB`
  const gib = bytes / 1024 ** 3
  return `${gib.toFixed(2)} GiB`
}

/**
 * Converts a bigint byte string to GiB as a number (for chart data).
 * Returns 0 for null, undefined, or empty string.
 */
export function bytesToGiB(bytesStr: string | null | undefined): number {
  if (!bytesStr) return 0
  return Number(BigInt(bytesStr)) / 1024 ** 3
}

/**
 * Formats a JS number of bytes into a human-readable string with auto-scaling.
 * Uses binary units (KiB, MiB, GiB, TiB, PiB).
 */
export function formatBytesFromNumber(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * Formats a JS number of bytes into a human-readable string with auto-scaling.
 * Uses binary units (KiB, MiB, GiB, TiB) by default, or decimal (KB, MB, GB, TB)
 * when binary is false. Handles negative values (e.g. negative buffer).
 */
export function formatBytesNum(bytes: number, binary = true): string {
  if (bytes === 0) return "0"
  const sign = bytes < 0 ? "-" : ""
  const abs = Math.abs(bytes)
  const k = binary ? 1024 : 1000
  const units = binary
    ? ["B", "KiB", "MiB", "GiB", "TiB"]
    : ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(abs) / Math.log(k)), units.length - 1)
  const val = abs / k ** i
  return `${sign}${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`
}

/**
 * Formats a ratio number to 2 decimal places.
 * Returns "—" for null/undefined.
 */
export function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "—"
  return ratio.toFixed(2)
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

const VALID_HEX_RE = /^#[0-9a-fA-F]{6}$/
const FALLBACK_HEX = "#00d4ff"

/**
 * Converts a hex color (#rrggbb) to rgba with the given alpha.
 * Falls back to the accent cyan (#00d4ff) for invalid inputs.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const safe = VALID_HEX_RE.test(hex) ? hex : FALLBACK_HEX
  const r = parseInt(safe.slice(1, 3), 16)
  const g = parseInt(safe.slice(3, 5), 16)
  const b = parseInt(safe.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Converts a hex color (#rrggbb) to HSL components.
 * Returns [hue (0-360), saturation (0-1), lightness (0-1)].
 */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return [h * 360, s, l]
}

/**
 * Converts HSL components to a hex color string.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = (((h % 360) + 360) % 360) / 360

  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, hNorm + 1 / 3)
    g = hue2rgb(p, q, hNorm)
    b = hue2rgb(p, q, hNorm - 1 / 3)
  }

  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Generates `count` visually distinct colors by rotating hue evenly across
 * 360°, anchored at the hue of `baseColor`. Saturation and lightness are
 * clamped to values that look good on dark backgrounds.
 */
export function generatePalette(count: number, baseColor: string): string[] {
  if (count === 0) return []
  const [baseH, baseS, baseL] = hexToHsl(baseColor)
  const sat = Math.max(baseS, 0.55)
  const lit = Math.min(Math.max(baseL, 0.45), 0.65)
  if (count === 1) return [hslToHex(baseH, sat, lit)]
  const step = 360 / count
  return Array.from({ length: count }, (_, i) =>
    hslToHex(baseH + i * step, sat, lit)
  )
}

/**
 * Generates a visually complementary color by rotating the hue.
 * Ensures visibility on dark backgrounds (min lightness 0.4, min saturation 0.5).
 */
export function getComplementaryColor(hex: string, rotation = 150): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h + rotation, Math.max(s, 0.5), Math.max(0.4, Math.min(0.7, l)))
}

export type StatMode = "ratio" | "seeding" | "uploaded" | "downloaded" | "buffer"

/**
 * Formats a stat value from TrackerLatestStats for display in the sidebar.
 * Returns "—" when stats are null or the requested field is missing.
 */
export function formatStatValue(
  stats: TrackerLatestStats | null,
  mode: StatMode
): string {
  if (!stats) return "—"

  switch (mode) {
    case "ratio":
      return stats.ratio !== null && stats.ratio !== undefined
        ? `${stats.ratio.toFixed(2)}x`
        : "—"
    case "seeding":
      return stats.seedingCount !== null && stats.seedingCount !== undefined
        ? `${stats.seedingCount.toLocaleString()} seeding`
        : "—"
    case "uploaded":
      return stats.uploadedBytes
        ? `${formatBytesFromString(stats.uploadedBytes)} ↑`
        : "—"
    case "downloaded":
      return stats.downloadedBytes
        ? `${formatBytesFromString(stats.downloadedBytes)} ↓`
        : "—"
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
 * Computes the 24-hour upload/download delta from a snapshot array.
 * Sorts snapshots ascending by polledAt before processing, so the result
 * is correct regardless of the order snapshots arrive in.
 * Returns null if fewer than 2 snapshots exist or no snapshot falls within
 * the 24-hour window.
 */
export function computeDelta(snaps: Snapshot[]): { uploaded: string; downloaded: string } | null {
  if (snaps.length < 2) return null

  const sorted = [...snaps].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  const latest = sorted[sorted.length - 1]
  const cutoff = Date.now() - 24 * 60 * 60 * 1000

  let earliest: Snapshot | null = null
  for (const s of sorted) {
    if (new Date(s.polledAt).getTime() >= cutoff) {
      earliest = s
      break
    }
  }

  if (!earliest || earliest === latest) return null
  if (!latest.uploadedBytes || !earliest.uploadedBytes || !latest.downloadedBytes || !earliest.downloadedBytes) return null

  try {
    const uploadDelta = BigInt(latest.uploadedBytes) - BigInt(earliest.uploadedBytes)
    const downloadDelta = BigInt(latest.downloadedBytes) - BigInt(earliest.downloadedBytes)
    return { uploaded: uploadDelta.toString(), downloaded: downloadDelta.toString() }
  } catch {
    return null
  }
}

/**
 * Formats a duration in seconds to a compact human-readable string.
 * e.g. 90 → "1m", 7200 → "2.0h", 172800 → "2.0d"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

/**
 * Formats a Date or ISO string as a compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago".
 */
export function formatTimeAgo(dateOrIso: Date | string): string {
  const ms = typeof dateOrIso === "string" ? new Date(dateOrIso).getTime() : dateOrIso.getTime()
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
