// src/lib/validators.ts
//
// Pure validation predicates and regex constants.
// No framework dependencies. Usable anywhere.
//
// Functions: isValidHex, isValidPort, isIntegerInRange, parseIntClamped, isRealCalendarDate,
//            validateImageUrl, safeImageUrl
// Constants: ISO_8601_RE, HEX_64_RE, DATE_RE

import { PORT_MAX, PORT_MIN } from "@/lib/limits"

const STRICT_HEX_RE = /^#[0-9a-fA-F]{6}$/
const PERMISSIVE_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
export const HEX_64_RE = /^[0-9a-fA-F]{64}$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Whether a DATE_RE or ISO_8601_RE value names a day that exists. Date rolls
 * February 30 into March, so the parsed day has to read back as the one given.
 * Sound for those two shapes only, since an offset can move the UTC day.
 */
export function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value.slice(0, 10)
}

export function isValidHex(value: string, permissive = false): boolean {
  return permissive ? PERMISSIVE_HEX_RE.test(value) : STRICT_HEX_RE.test(value)
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX
}

export function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max
}

/** Parse a string to int, clamp to [min, max], fall back to defaultValue for null/NaN. */
export function parseIntClamped(
  raw: string | null,
  min: number,
  max: number,
  defaultValue: number
): number {
  const parsed = parseInt(raw ?? String(defaultValue), 10)
  return Math.min(Math.max(min, Number.isNaN(parsed) ? defaultValue : parsed), max)
}

export function validateImageUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Invalid URL protocol")
    }
    return url
  } catch {
    throw new Error("Invalid URL in image host response")
  }
}

export function safeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return validateImageUrl(url)
  } catch {
    return undefined
  }
}
