// src/lib/helpers.ts

// Functions: computeDelta, compareBigIntDesc, computePctChange,
//            floatBytesToBigInt, computeBufferBytes, isUnixTimestampOnDate,
//            sanitizeHost, normalizeUrl, extractApiError

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

export function computePctChange(today: string, yesterday: string | null): number | null {
  if (yesterday === null) return null
  try {
    const y = Number(BigInt(yesterday))
    if (y === 0) return null
    const t = Number(BigInt(today))
    return ((t - y) / y) * 100
  } catch {
    return null
  }
}

export function floatBytesToBigInt(n: number | null | undefined): bigint {
  return BigInt(Math.max(0, Math.floor(n ?? 0)))
}

export function computeBufferBytes(uploaded: bigint, downloaded: bigint): bigint {
  return uploaded > downloaded ? uploaded - downloaded : 0n
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

export async function extractApiError(res: Response, fallback = "Request failed"): Promise<string> {
  try {
    const data: { error?: string } = await res.json()
    return data.error ?? fallback
  } catch {
    return fallback
  }
}
