// src/lib/tracker-platforms/helpers/class-name.ts
//
// Functions: presentClass

/**
 * The class a tracker sent for `TrackerStats.group`, or null when it sent none.
 * A JSON reader checks only the byte totals, so the class can be absent, blank
 * or not a string despite its declared type, and each of those is no class.
 */
export function presentClass(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}
