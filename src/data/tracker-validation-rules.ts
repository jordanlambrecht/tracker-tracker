// src/data/tracker-validation-rules.ts
//
// Shared constants for tracker registry validation.
// Used by both the CI script and the test suite.

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const LOGO_NAME_RE = /^\/tracker-logos\/[a-z0-9_]+_logo\.(svg|png)$/
export const PLACEHOLDER_RE = /^TODO$/i

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

export { normalizeUrl as normalizeTrackerUrl } from "@/lib/data-transforms"
