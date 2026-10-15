// src/lib/data-transforms.ts

// Functions: computeDelta, compareBigIntDesc, computePctChange,
//            floatBytesToBigInt, signedFloatBytesToBigInt, computeBufferBytes,
//            computeRatio, isUnixTimestampOnDate,
//            sanitizeHost, stripTrailingSlash, normalizeUrl

import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"

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
  if (
    !latest.uploadedBytes ||
    !earliest.uploadedBytes ||
    !latest.downloadedBytes ||
    !earliest.downloadedBytes
  )
    return null

  try {
    const uploadDelta = BigInt(latest.uploadedBytes) - BigInt(earliest.uploadedBytes)
    const downloadDelta = BigInt(latest.downloadedBytes) - BigInt(earliest.downloadedBytes)
    return { uploaded: uploadDelta.toString(), downloaded: downloadDelta.toString() }
  } catch {
    return null
  }
}

export function compareBigIntDesc(a: bigint, b: bigint): number {
  if (b > a) return 1
  if (b < a) return -1
  return 0
}

/**
 * Percent change from yesterday's value to today's.
 *
 * Null when yesterday is non-positive or today is negative. A negative baseline
 * inverts the sign, and buffer deltas are signed, so that is a normal reading
 * on the buffer card.
 */
export function computePctChange(today: string, yesterday: string | null): number | null {
  if (yesterday === null) return null
  try {
    const y = Number(BigInt(yesterday))
    if (y <= 0) return null
    const t = Number(BigInt(today))
    if (t < 0) return null
    return ((t - y) / y) * 100
  } catch {
    return null
  }
}

/**
 * Converts a tracker's float byte count to a bigint, clamped at zero.
 *
 * Only for non-negative quantities, uploaded, downloaded, sizes. Those are
 * monotonic counters, so a negative is always a malformed API response, and the
 * clamp is the only thing stopping that from being written into the snapshots
 * table. Do not reach for this for buffer: buffer is conventionally signed on a
 * private tracker and clamping it reports a deficit account as a confident
 * zero. Use `signedFloatBytesToBigInt` for that.
 */
export function floatBytesToBigInt(n: number | null | undefined): bigint {
  return BigInt(Math.max(0, Math.floor(n ?? 0)))
}

/**
 * Converts a tracker's own reported buffer to a bigint, sign intact.
 *
 * Buffer on a private tracker is signed by convention, Hawke returns
 * -2627286052460 for a deficit account and Gazelle sites report negative buffer
 * too, so this deliberately has no `Math.max(0, ...)`. Never use it for
 * uploaded/downloaded/sizes; those keep `floatBytesToBigInt`'s clamp.
 *
 * `Math.trunc`, not `Math.floor`: floor rounds negatives away from zero
 * (floor(-0.5) === -1), which would silently deepen a reported deficit.
 */
export function signedFloatBytesToBigInt(n: number | null | undefined): bigint {
  return BigInt(Math.trunc(n ?? 0))
}

/**
 * Buffer derived from byte totals, unclamped. A zero floor would draw a
 * worsening deficit as a flat line, so a negative result is real data.
 */
export function computeBufferBytes(uploaded: bigint, downloaded: bigint): bigint {
  return uploaded - downloaded
}

/**
 * Ratio derived from byte totals rather than a tracker's own `ratio` field.
 *
 * Sites report a zero-download ratio inconsistently, and those values parse to
 * a misleading 0 that renders as critical. The byte totals are unambiguous, so
 * derive from them.
 *
 * Returns `Infinity` for uploads with zero downloads. Callers serializing to
 * JSON must handle that (see `ratioIsInfinite` in the tracker serializer).
 */
export function computeRatio(uploaded: bigint, downloaded: bigint): number {
  if (downloaded === 0n) return uploaded > 0n ? Infinity : 0
  return Number(uploaded) / Number(downloaded)
}

export function isUnixTimestampOnDate(unixSeconds: number, dateStr: string): boolean {
  if (unixSeconds <= 0) return false
  return localDateStr(new Date(unixSeconds * 1000)) === dateStr
}

export function sanitizeHost(host: string): string {
  return host.trim().replace(/^https?:\/\//, "")
}

/**
 * For a base URL on its way into storage. Adapters both concatenate onto it and
 * feed it to `new URL`, and a stored trailing slash gives the first form a
 * doubled separator. Deliberately not normalizeUrl, which also lowercases: a
 * base URL is later joined with encoded usernames and case-sensitive paths.
 */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

/** stripTrailingSlash plus case folding, for comparing two URLs for sameness. */
export function normalizeUrl(url: string): string {
  return stripTrailingSlash(url).toLowerCase()
}
