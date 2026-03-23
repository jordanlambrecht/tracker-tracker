// scripts/validate-trackers.ts
//
// Standalone tracker validation script for CI.
// Outputs JSON to stdout: { results: TrackerResult[] }
// Each result has slug, errors[], warnings[].
//
// Usage: npx tsx scripts/validate-trackers.ts [slug1 slug2 ...]
// If slugs are provided, only those trackers are validated.
// If no slugs, all non-draft trackers are validated.

import fs from "node:fs"
import path from "node:path"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { ALL_TRACKERS } from "@/data/trackers"
import { DEFAULT_API_PATHS } from "@/lib/adapters/constants"

const VALID_PLATFORMS = ["unit3d", "gazelle", "ggn", "nebulance", "custom"] as const
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const LOGO_NAME_RE = /^\/tracker-logos\/[a-z0-9_]+_logo\.(svg|png)$/
const PLACEHOLDER_RE = /^TODO$/i
const LOGO_DIR = path.resolve(__dirname, "../public/tracker-logos")
const TRACKER_DIR = path.resolve(__dirname, "../src/data/trackers")

const VALID_CONTENT_CATEGORIES = new Set([
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

function isEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return true
  if (typeof val === "string") return val.trim().length === 0
  if (Array.isArray(val)) return val.length === 0
  return false
}

interface TrackerResult {
  slug: string
  name: string
  draft: boolean
  errors: string[]
  warnings: string[]
}

function validate(slugFilter?: string[]): TrackerResult[] {
  // Check for global issues first
  const allSlugs = ALL_TRACKERS.map((t: TrackerRegistryEntry) => t.slug)
  const dupeSlugs = allSlugs.filter((s: string, i: number) => allSlugs.indexOf(s) !== i)
  const normalize = (u: string) => u.replace(/\/+$/, "").toLowerCase()
  const allUrls = ALL_TRACKERS.map((t: TrackerRegistryEntry) => normalize(t.url))
  const dupeUrls = allUrls.filter((u: string, i: number) => allUrls.indexOf(u) !== i)

  const nonDraft = ALL_TRACKERS.filter((t: TrackerRegistryEntry) => !t.draft)
  const trackers = slugFilter
    ? nonDraft.filter((t: TrackerRegistryEntry) => slugFilter.includes(t.slug))
    : nonDraft

  return trackers.map((tracker: TrackerRegistryEntry) => {
    const errors: string[] = []
    const warnings: string[] = []

    // ── Global duplication checks ─────────────────────────────────────
    if (dupeSlugs.includes(tracker.slug)) errors.push("Duplicate slug")
    if (dupeUrls.includes(normalize(tracker.url))) errors.push("Duplicate URL")

    // ── Required fields (errors) ──────────────────────────────────────
    if (!SLUG_RE.test(tracker.slug)) errors.push("Invalid slug format")
    if (isEmpty(tracker.name)) errors.push("Missing name")
    if (!(VALID_PLATFORMS as readonly string[]).includes(tracker.platform)) {
      errors.push(`Invalid platform "${tracker.platform}"`)
    }
    if (tracker.platform !== "custom") {
      const expected = DEFAULT_API_PATHS[tracker.platform]
      if (tracker.apiPath !== expected) {
        errors.push(
          `apiPath "${tracker.apiPath}" does not match platform "${tracker.platform}" (expected "${expected}")`
        )
      }
    }
    if (!/^https:\/\//.test(tracker.url)) {
      errors.push("URL must use https://")
    } else {
      try {
        new URL(tracker.url)
      } catch {
        errors.push("Invalid URL format")
      }
    }
    if (isEmpty(tracker.contentCategories)) {
      errors.push("Missing contentCategories")
    } else {
      const invalid = tracker.contentCategories.filter(
        (c: string) => !VALID_CONTENT_CATEGORIES.has(c)
      )
      if (invalid.length > 0) errors.push(`Invalid categories: ${invalid.join(", ")}`)
    }
    if (isEmpty(tracker.language)) errors.push("Missing language")

    // ── Numeric rules validation ──────────────────────────────────────
    const rules = tracker.rules
    if (!rules) {
      errors.push("Missing rules object")
    } else {
      if (typeof rules.minimumRatio !== "number") {
        errors.push("Missing rules.minimumRatio")
      } else if (rules.minimumRatio < 0) {
        errors.push(`rules.minimumRatio must be >= 0 (got ${rules.minimumRatio})`)
      }

      if (typeof rules.seedTimeHours !== "number") {
        errors.push("Missing rules.seedTimeHours")
      } else {
        if (rules.seedTimeHours < 0)
          errors.push(`rules.seedTimeHours must be >= 0 (got ${rules.seedTimeHours})`)
        if (!Number.isInteger(rules.seedTimeHours))
          errors.push(`rules.seedTimeHours must be an integer (got ${rules.seedTimeHours})`)
      }

      if (typeof rules.loginIntervalDays !== "number") {
        errors.push("Missing rules.loginIntervalDays")
      } else {
        if (rules.loginIntervalDays < 0)
          errors.push(`rules.loginIntervalDays must be >= 0 (got ${rules.loginIntervalDays})`)
        if (!Number.isInteger(rules.loginIntervalDays))
          errors.push(`rules.loginIntervalDays must be an integer (got ${rules.loginIntervalDays})`)
      }

      if (rules.fulfillmentPeriodHours != null) {
        if (!Number.isInteger(rules.fulfillmentPeriodHours))
          errors.push(
            `rules.fulfillmentPeriodHours must be an integer (got ${rules.fulfillmentPeriodHours})`
          )
        if (rules.fulfillmentPeriodHours < 0)
          errors.push(
            `rules.fulfillmentPeriodHours must be >= 0 (got ${rules.fulfillmentPeriodHours})`
          )
      }

      if (rules.hnrBanLimit != null) {
        if (!Number.isInteger(rules.hnrBanLimit))
          errors.push(`rules.hnrBanLimit must be an integer (got ${rules.hnrBanLimit})`)
        if (rules.hnrBanLimit < 0)
          errors.push(`rules.hnrBanLimit must be >= 0 (got ${rules.hnrBanLimit})`)
      }
    }

    // ── Format checks (errors) ────────────────────────────────────────
    if (PLACEHOLDER_RE.test(tracker.description?.trim() ?? "")) {
      errors.push("Description is still a placeholder (TODO)")
    }
    const dupeCats = tracker.contentCategories.filter(
      (c: string, i: number) => tracker.contentCategories.indexOf(c) !== i
    )
    if (dupeCats.length > 0)
      errors.push(`Duplicate categories: ${[...new Set(dupeCats)].join(", ")}`)

    if (tracker.color && !HEX_COLOR_RE.test(tracker.color)) {
      errors.push(`Invalid hex color "${tracker.color}"`)
    }
    if (tracker.logo) {
      if (!LOGO_NAME_RE.test(tracker.logo)) {
        errors.push(`Logo "${tracker.logo}" must match /tracker-logos/<name>_logo.(svg|png)`)
      }
      const logoFile = path.join(LOGO_DIR, path.basename(tracker.logo))
      if (!fs.existsSync(logoFile)) {
        errors.push(`Logo file not found: public${tracker.logo}`)
      }
    }

    // ── Canonical field presence (every field must be explicitly set) ─
    const obj = tracker as unknown as Record<string, unknown>
    const CANONICAL_FIELDS = [
      "slug",
      "name",
      "abbreviation",
      "url",
      "description",
      "platform",
      "apiPath",
      "specialty",
      "contentCategories",
      "language",
      "color",
      "logo",
      "trackerHubSlug",
      "statusPageUrl",
      "userClasses",
      "releaseGroups",
      "bannedGroups",
      "notableMembers",
      "rules",
      "warning",
      "warningNote",
      "draft",
      "supportsTransitPapers",
      "profileUrlPattern",
    ] as const
    for (const field of CANONICAL_FIELDS) {
      if (!(field in obj)) {
        errors.push(`Missing canonical field "${field}" — all fields must be explicitly present`)
      }
    }

    // ── Platform-specific field checks ─────────────────────────────────
    if (tracker.platform === "gazelle" && !tracker.gazelleEnrich) {
      errors.push("Gazelle trackers must have gazelleEnrich: true")
    }

    // ── Transit Papers validation ────────────────────────────────────
    if (tracker.supportsTransitPapers) {
      if (!tracker.profileUrlPattern) {
        errors.push("supportsTransitPapers is true but profileUrlPattern is missing")
      } else {
        const pattern = tracker.profileUrlPattern
        if (!pattern.includes("{id}") && !pattern.includes("{username}")) {
          errors.push(
            `profileUrlPattern must contain {id} or {username} (got "${pattern}")`
          )
        }
      }
    }
    if (tracker.profileUrlPattern && !tracker.supportsTransitPapers) {
      warnings.push("profileUrlPattern defined but supportsTransitPapers is not true")
    }

    // ── Warn-level fields ─────────────────────────────────────────────
    if (isEmpty(tracker.abbreviation)) warnings.push("Missing abbreviation")
    if (isEmpty(tracker.specialty)) warnings.push("Missing specialty")
    if (isEmpty(tracker.userClasses)) warnings.push("Missing userClasses")
    if (isEmpty(tracker.releaseGroups)) warnings.push("Missing releaseGroups")
    if (isEmpty(tracker.notableMembers)) warnings.push("Missing notableMembers")
    if (isEmpty(tracker.bannedGroups)) warnings.push("Missing bannedGroups")
    if (!tracker.stats || Object.values(tracker.stats).every((v) => v === undefined)) {
      warnings.push("Missing stats")
    }
    if (isEmpty(tracker.rules?.fullRulesMarkdown)) warnings.push("Missing rules.fullRulesMarkdown")
    if (isEmpty(tracker.color)) warnings.push("Missing color")
    if (isEmpty(tracker.logo)) warnings.push("Missing logo")
    if (isEmpty(tracker.trackerHubSlug)) warnings.push("Missing trackerHubSlug")

    return { slug: tracker.slug, name: tracker.name, draft: false, errors, warnings }
  })
}

function checkBarrelInclusion(): string[] {
  const barrelPath = path.join(TRACKER_DIR, "index.ts")
  if (!fs.existsSync(barrelPath)) return ["Barrel file src/data/trackers/index.ts not found"]
  const barrelContent = fs.readFileSync(barrelPath, "utf8")
  const files = fs
    .readdirSync(TRACKER_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && !f.startsWith("_"))
    .map((f) => f.replace(/\.ts$/, ""))
  return files
    .filter((f) => !barrelContent.includes(`./${f}`))
    .map((f) => `${f}.ts not imported in barrel file (src/data/trackers/index.ts)`)
}

// ── CLI entry ───────────────────────────────────────────────────────────
const slugArgs = process.argv.slice(2).filter((a) => !a.startsWith("-"))
const results = validate(slugArgs.length > 0 ? slugArgs : undefined)
const barrelErrors = checkBarrelInclusion()
if (barrelErrors.length > 0) {
  results.unshift({
    slug: "_barrel",
    name: "Barrel File",
    draft: false,
    errors: barrelErrors,
    warnings: [],
  })
}

// Output JSON to stdout for CI consumption
console.log(JSON.stringify({ results }, null, 2))

// Exit 1 if any errors
const hasErrors = results.some((r) => r.errors.length > 0)
process.exit(hasErrors ? 1 : 0)
