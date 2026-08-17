// src/data/tracker-validation-rules.ts
//
// Shared constants and predicates for tracker registry validation.
// Used by both the CI script and the test suite.

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const LOGO_NAME_RE = /^\/tracker-logos\/[a-z0-9_]+_logo\.(svg|png)$/
export const PLACEHOLDER_RE = /^TODO$/i

/**
 * `defunctDate` must be a plain "YYYY-MM-DD" calendar date — the same shape as a
 * tracker row's `joinedAt`, so it renders through `formatJoinedDate()`. A free-form
 * display string ("May 2026") would parse to Invalid Date there.
 */
export const DEFUNCT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const VALID_CONTENT_CATEGORIES = new Set([
  "Movies",
  "TV",
  "Music",
  "Games",
  "Apps",
  "Sports",
  "Books",
  "Audiobooks",
  "Comics",
  "Manga",
  "Anime",
  "XXX",
  "Documentaries",
  "Education",
  "Tutorials",
  "Fanres",
])

export function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (typeof val === "string" && val.trim() === "") return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

/**
 * Validates the four `defunct*` fields as a group.
 *
 * These drive a banner that tells the user to archive their tracker, so a
 * half-filled entry is worse than none: a shutdown notice with no date and no
 * explanation reads as a bug. `defunct: true` therefore requires both the date
 * and the message, and the date must be a real calendar day because the UI
 * parses it. Details set *without* `defunct: true` are inert rather than
 * broken — most likely a half-finished edit — so those only warn.
 *
 * This lives here, not in the CI script, because the script cannot be imported
 * (it runs `process.exit` / `console.log` on module load) and the registry test
 * suite has to apply the identical rule to the shipped data.
 */
export function validateDefunct(tracker: Partial<TrackerRegistryEntry>): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (tracker.defunct) {
    if (isEmpty(tracker.defunctDate)) {
      errors.push("defunct is true but defunctDate is missing")
    } else if (!DEFUNCT_DATE_RE.test(tracker.defunctDate as string)) {
      errors.push(`defunctDate must be "YYYY-MM-DD" (got "${tracker.defunctDate}")`)
    } else {
      // The regex admits "2026-02-31". Round-tripping through Date catches the
      // rollover that would otherwise render as a plausible-looking wrong day.
      const iso = tracker.defunctDate as string
      const parsed = new Date(`${iso}T00:00:00`)
      if (Number.isNaN(parsed.getTime()) || !parsed.toLocaleDateString("en-CA").startsWith(iso)) {
        errors.push(`defunctDate "${iso}" is not a real calendar date`)
      }
    }
    if (isEmpty(tracker.defunctMessage)) {
      errors.push("defunct is true but defunctMessage is missing")
    }
  } else {
    for (const [field, value] of [
      ["defunctMessage", tracker.defunctMessage],
      ["defunctLink", tracker.defunctLink],
      ["defunctDate", tracker.defunctDate],
    ] as const) {
      if (!isEmpty(value)) warnings.push(`${field} is set but defunct is not true`)
    }
  }

  if (!isEmpty(tracker.defunctLink)) {
    const link = tracker.defunctLink as string
    if (!/^https:\/\//.test(link)) {
      errors.push(`defunctLink must use https:// (got "${link}")`)
    } else {
      try {
        new URL(link)
      } catch {
        errors.push(`defunctLink is not a valid URL (got "${link}")`)
      }
    }
  }

  return { errors, warnings }
}

export { normalizeUrl as normalizeTrackerUrl } from "@/lib/data-transforms"
