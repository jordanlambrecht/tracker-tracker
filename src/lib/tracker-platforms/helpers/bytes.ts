// src/lib/tracker-platforms/helpers/bytes.ts
//
// Functions: requireBytes

import { floatBytesToBigInt } from "@/lib/data-transforms"

/**
 * A byte total the API is contracted to send, as a bigint, or an error naming
 * the field. Both totals are non-nullable on TrackerStats, so an absent one
 * fails the poll rather than storing a measured zero (adapter standard 2.1).
 * Takes `unknown` because no adapter checks these fields at runtime.
 */
export function requireBytes(value: unknown, field: string, hostname: string): bigint {
  if (value == null) {
    throw new Error(`Unexpected response from ${hostname}: missing ${field}`)
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Unexpected response from ${hostname}: non-numeric ${field}`)
  }
  return floatBytesToBigInt(value)
}
