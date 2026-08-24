// src/lib/data-transforms.ts

// Functions: computeDelta, compareBigIntDesc, computePctChange,
//            floatBytesToBigInt, signedFloatBytesToBigInt, computeBufferBytes,
//            computeRatio, isUnixTimestampOnDate,
//            sanitizeHost, normalizeUrl

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
 * Returns null when either side is non-positive rather than printing a number
 * that means the opposite of what it says. Dividing by a negative baseline
 * inverts the sign: a buffer recovering from -100 to -50 came out as
 * "-50% vs yesterday" and a deterioration from -100 to -200 as "+100%". Buffer
 * deltas are signed, so that is not a corner case for the buffer card, it is
 * the normal reading for any account in deficit. Upload/download deltas are
 * monotonic and only reach this guard on a tracker-side counter reset, where
 * "no percentage" is also the honest answer.
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
 * ONLY for non-negative quantities, uploaded, downloaded, sizes. Those are
 * monotonic counters, so a negative is always a malformed API response, and the
 * clamp is the only thing stopping that from being written into the snapshots
 * table. Do NOT reach for this for buffer: buffer is conventionally SIGNED on a
 * private tracker and clamping it reports a deficit account as a confident
 * zero. Use `signedFloatBytesToBigInt` for that.
 */
export function floatBytesToBigInt(n: number | null | undefined): bigint {
  return BigInt(Math.max(0, Math.floor(n ?? 0)))
}

/**
 * Converts a tracker's own REPORTED buffer to a bigint, sign intact.
 *
 * Buffer on a private tracker is signed by convention, Hawke returns
 * -2627286052460 for a deficit account and Gazelle sites report negative buffer
 * too, so this deliberately has no `Math.max(0, ...)`. Never use it for
 * uploaded/downloaded/sizes; those keep `floatBytesToBigInt`'s clamp.
 *
 * `Math.trunc`, not `Math.floor`: floor rounds negatives AWAY from zero
 * (floor(-0.5) === -1), which would silently deepen a reported deficit.
 */
export function signedFloatBytesToBigInt(n: number | null | undefined): bigint {
  return BigInt(Math.trunc(n ?? 0))
}

/**
 * Buffer DERIVED from byte totals: plainly `uploaded - downloaded`.
 *
 * Deliberately unclamped. This app is a time series, and a buffer floored at
 * zero draws a flat line while an account deteriorates, visually identical to
 * holding steady at breakeven, so the chart cannot show the user getting worse.
 * A negative result is real information, not an error to be swallowed. Please
 * do not re-add a `> 0n` guard here for symmetry with `floatBytesToBigInt`:
 * that helper guards counters that cannot go negative, this one computes a
 * quantity that can.
 */
export function computeBufferBytes(uploaded: bigint, downloaded: bigint): bigint {
  return uploaded - downloaded
}

/**
 * Ratio derived from byte totals rather than a tracker's own `ratio` field.
 *
 * Sites disagree wildly on how to report an account with no downloads,
 * UNIT3D sends the string `"∞"`, Gazelle sends `-1`, MAM sends something
 * undocumented, and every one of those parses to a misleading `0`, which
 * renders as a critical ratio on a perfectly healthy account. The byte totals
 * are unambiguous everywhere, so derive from them.
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

export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase()
}
