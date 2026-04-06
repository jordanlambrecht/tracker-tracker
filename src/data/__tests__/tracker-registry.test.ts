// src/data/__tests__/tracker-registry.test.ts
//
// Validates all tracker registry entries for consistency.
// Catches platform/apiPath mismatches, duplicate slugs, invalid fields, etc.
// Runs in CI — a bad tracker file will fail the PR.
//
// Draft trackers (draft: true) are exempt from strict validation.
// Non-draft trackers must pass all required checks.
// Warnings are printed but do not fail the test.

import fs from "node:fs"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
  getTrackerBySlug,
  TRACKER_REGISTRY,
  type TrackerRegistryEntry,
} from "@/data/tracker-registry"
import {
  isEmpty,
  LOGO_NAME_RE,
  normalizeTrackerUrl,
  PLACEHOLDER_RE,
  SLUG_RE,
  VALID_CONTENT_CATEGORIES,
} from "@/data/tracker-validation-rules"
import { ALL_TRACKERS } from "@/data/trackers"
import { DEFAULT_API_PATHS } from "@/lib/adapters"
import { isValidHex } from "@/lib/validators"

const VALID_PLATFORMS = [
  "unit3d",
  "gazelle",
  "ggn",
  "nebulance",
  "mam",
  "avistaz",
  "custom",
] as const
const TRACKER_DIR = path.resolve(__dirname, "../../data/trackers")
const LOGO_DIR = path.resolve(__dirname, "../../../public/tracker-logos")

// ---------------------------------------------------------------------------
// Warning collector — printed after all tests, does not fail CI
// ---------------------------------------------------------------------------

const warnings: string[] = []

function warn(tracker: string, msg: string) {
  warnings.push(`WARN: ${tracker} — ${msg}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRODUCTION_TRACKERS = ALL_TRACKERS.filter((t: TrackerRegistryEntry) => !t.draft)
const DRAFT_TRACKERS = ALL_TRACKERS.filter((t: TrackerRegistryEntry) => t.draft)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tracker registry", () => {
  // ── Global uniqueness (all trackers, including drafts) ────────────────

  it("has no duplicate slugs", () => {
    const slugs = ALL_TRACKERS.map((t: TrackerRegistryEntry) => t.slug)
    const dupes = slugs.filter((s: string, i: number) => slugs.indexOf(s) !== i)
    expect(dupes, `Duplicate slugs: ${dupes.join(", ")}`).toEqual([])
  })

  it("has no duplicate URLs", () => {
    const urls = ALL_TRACKERS.map((t: TrackerRegistryEntry) => normalizeTrackerUrl(t.url))
    const dupes = urls.filter((u: string, i: number) => urls.indexOf(u) !== i)
    expect(dupes, `Duplicate URLs: ${dupes.join(", ")}`).toEqual([])
  })

  it("every tracker has an explicit draft field (true or false)", () => {
    for (const tracker of ALL_TRACKERS) {
      expect(
        typeof tracker.draft === "boolean",
        `${tracker.slug} is missing an explicit draft: true/false field`
      ).toBe(true)
    }
  })

  it("every tracker file in src/data/trackers/ is registered in the barrel", () => {
    const files = fs
      .readdirSync(TRACKER_DIR)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts" && !f.startsWith("_"))
      .map((f) => f.replace(/\.ts$/, ""))
    // Read barrel to get actual imported filenames
    const barrelContent = fs.readFileSync(path.join(TRACKER_DIR, "index.ts"), "utf8")
    const unregistered = files.filter((f) => !barrelContent.includes(`./${f}`))
    expect(
      unregistered,
      `Tracker files not imported in index.ts: ${unregistered.join(", ")}. Did you forget to add them to the barrel?`
    ).toEqual([])
  })

  // ── Draft trackers — basic format checks only ─────────────────────────

  describe("draft trackers", () => {
    for (const tracker of DRAFT_TRACKERS) {
      describe(tracker.slug, () => {
        it("has a valid slug format", () => {
          expect(tracker.slug).toMatch(SLUG_RE)
        })

        it("has a valid platform", () => {
          expect(VALID_PLATFORMS).toContain(tracker.platform)
        })

        it("has a valid https URL", () => {
          expect(tracker.url).toMatch(/^https:\/\//)
        })
      })
    }
  })

  // ── Non-draft trackers — strict validation ────────────────────────────

  describe("production trackers", () => {
    for (const tracker of PRODUCTION_TRACKERS) {
      describe(tracker.slug, () => {
        // ── Required fields (fail) ────────────────────────────────────

        it("has a valid slug format", () => {
          expect(
            tracker.slug,
            `"${tracker.slug}" must be lowercase alphanumeric with hyphens`
          ).toMatch(SLUG_RE)
        })

        it("has a non-empty name", () => {
          expect(tracker.name.trim().length).toBeGreaterThan(0)
        })

        it("has a valid platform", () => {
          expect(VALID_PLATFORMS).toContain(tracker.platform)
        })

        it("has an apiPath matching its platform", () => {
          if (tracker.platform === "custom") return
          const expected = DEFAULT_API_PATHS[tracker.platform]
          expect(
            tracker.apiPath,
            `${tracker.name} is platform "${tracker.platform}" but uses apiPath "${tracker.apiPath}" — expected "${expected}"`
          ).toBe(expected)
        })

        it("has a valid https URL", () => {
          expect(tracker.url).toMatch(/^https:\/\//)
          expect(() => new URL(tracker.url)).not.toThrow()
        })

        it("has at least one content category", () => {
          expect(tracker.contentCategories.length).toBeGreaterThan(0)
        })

        it("uses only allowed content categories", () => {
          const invalid = tracker.contentCategories.filter(
            (c: string) => !VALID_CONTENT_CATEGORIES.has(c)
          )
          expect(
            invalid,
            `Invalid categories: ${invalid.join(", ")}. Allowed: ${[...VALID_CONTENT_CATEGORIES].join(", ")}`
          ).toEqual([])
        })

        it("has a language", () => {
          expect(tracker.language?.trim().length, "language is required").toBeGreaterThan(0)
        })

        it("has rules.minimumRatio as a non-negative number", () => {
          const r = tracker.rules?.minimumRatio
          expect(r, "rules.minimumRatio is required").not.toBeUndefined()
          expect(r, "rules.minimumRatio must be a number").toBeTypeOf("number")
          expect(r, "rules.minimumRatio must be >= 0").toBeGreaterThanOrEqual(0)
        })

        it("has rules.seedTimeHours as a non-negative integer", () => {
          const r = tracker.rules?.seedTimeHours
          expect(r, "rules.seedTimeHours is required").not.toBeUndefined()
          expect(r, "rules.seedTimeHours must be a number").toBeTypeOf("number")
          expect(r, "rules.seedTimeHours must be >= 0").toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(r), "rules.seedTimeHours must be an integer").toBe(true)
        })

        it("has rules.loginIntervalDays as a non-negative integer (0 = no policy)", () => {
          const r = tracker.rules?.loginIntervalDays
          expect(r, "rules.loginIntervalDays is required").not.toBeUndefined()
          expect(r, "rules.loginIntervalDays must be a number").toBeTypeOf("number")
          expect(r, "rules.loginIntervalDays must be >= 0").toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(r), "rules.loginIntervalDays must be an integer").toBe(true)
        })

        it("has a non-placeholder description", () => {
          expect(
            PLACEHOLDER_RE.test(tracker.description.trim()),
            `description is still "TODO" — fill it in before removing draft`
          ).toBe(false)
        })

        it("has no duplicate content categories", () => {
          const seen = new Set<string>()
          const dupes = tracker.contentCategories.filter((c: string) => {
            if (seen.has(c)) return true
            seen.add(c)
            return false
          })
          expect(dupes, `Duplicate categories: ${dupes.join(", ")}`).toEqual([])
        })

        // ── Format checks (fail) ─────────────────────────────────────

        if (tracker.color) {
          it("has a valid hex color", () => {
            expect(isValidHex(tracker.color as string)).toBe(true)
          })
        }

        if (tracker.logo) {
          it("logo follows naming convention (lowercase_logo.svg|png)", () => {
            expect(
              tracker.logo,
              `Logo "${tracker.logo}" must match pattern /tracker-logos/<name>_logo.(svg|png)`
            ).toMatch(LOGO_NAME_RE)
          })

          it("logo file exists on disk", () => {
            // biome-ignore lint/style/noNonNullAssertion: test only runs for trackers with logos
            const logoFile = path.join(LOGO_DIR, path.basename(tracker.logo!))
            expect(fs.existsSync(logoFile), `Logo file not found: public${tracker.logo}`).toBe(true)
          })
        }

        // ── Warn-level fields (collected, not asserted) ──────────────

        it("collects warnings for incomplete fields", () => {
          const missing: string[] = []

          if (isEmpty(tracker.abbreviation)) missing.push("abbreviation")
          if (isEmpty(tracker.specialty)) missing.push("specialty")
          if (isEmpty(tracker.userClasses)) missing.push("userClasses")
          if (isEmpty(tracker.releaseGroups)) missing.push("releaseGroups")
          if (isEmpty(tracker.notableMembers)) missing.push("notableMembers")
          if (isEmpty(tracker.bannedGroups)) missing.push("bannedGroups")
          if (!tracker.stats || Object.values(tracker.stats).every((v) => v === undefined)) {
            missing.push("stats")
          }
          if (isEmpty(tracker.rules?.fullRulesMarkdown)) missing.push("rules.fullRulesMarkdown")
          if (isEmpty(tracker.color)) missing.push("color")
          if (isEmpty(tracker.logo)) missing.push("logo")
          if (isEmpty(tracker.trackerHubSlug)) missing.push("trackerHubSlug")

          if (missing.length > 0) {
            warn(tracker.slug, `missing ${missing.join(", ")}`)
          }

          // Always passes — warnings don't fail the build
          expect(true).toBe(true)
        })
      })
    }
  })

  // ── Migrated from src/data/tracker-registry.test.ts ──────────────────

  it("has at least 2 trackers", () => {
    expect(TRACKER_REGISTRY.length).toBeGreaterThanOrEqual(2)
  })

  describe("getTrackerBySlug", () => {
    it("returns correct tracker", () => {
      const aither = getTrackerBySlug("aither")
      expect(aither?.name).toBe("Aither")
    })

    it("returns undefined for unknown slug", () => {
      expect(getTrackerBySlug("nonexistent")).toBeUndefined()
    })
  })

  // ── Print collected warnings after all tests ──────────────────────────

  afterAll(() => {
    if (warnings.length > 0) {
      console.warn("\n── Tracker registry warnings ──────────────────────────")
      for (const w of warnings) {
        console.warn(w)
      }
      console.warn("──────────────────────────────────────────────────────\n")
    }
  })
})
