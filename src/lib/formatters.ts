// src/lib/formatters.ts
//
// Functions: formatBytesFromString, bytesToGiB, formatRatio

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
 */
export function bytesToGiB(bytesStr: string): number {
  return Number(BigInt(bytesStr)) / 1024 ** 3
}

/**
 * Formats a ratio number to 2 decimal places.
 * Returns "—" for null/undefined.
 */
export function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "—"
  return ratio.toFixed(2)
}
