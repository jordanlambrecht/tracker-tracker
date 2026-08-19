// src/lib/__tests__/validate-trackers.test.ts
//
// Functions:
//   - describe("transit papers validation")
//   - describe("defunct validation")

import { describe, expect, it } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { validateDefunct } from "@/data/tracker-validation-rules"

// ---------------------------------------------------------------------------
// Local mirror of the transit-papers validation logic from
// scripts/validate-trackers.ts. Do NOT import that script directly — it runs
// CLI side-effects (process.exit, console.log) on module load.
//
// The defunct rule below needs no mirror: it lives in
// src/data/tracker-validation-rules.ts, which the script imports, so these tests
// exercise the real implementation and cannot drift from it. Transit papers
// predates that arrangement and is still duplicated here.
// ---------------------------------------------------------------------------

function validateTransitPapers(entry: Partial<TrackerRegistryEntry>): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (entry.supportsTransitPapers) {
    if (!entry.profileUrlPattern) {
      errors.push("supportsTransitPapers is true but profileUrlPattern is missing")
    } else {
      const pattern = entry.profileUrlPattern
      if (!pattern.includes("{id}") && !pattern.includes("{username}")) {
        errors.push(`profileUrlPattern must contain {id} or {username} (got "${pattern}")`)
      }
    }
  }

  if (entry.profileUrlPattern && !entry.supportsTransitPapers) {
    warnings.push("profileUrlPattern defined but supportsTransitPapers is not true")
  }

  return { errors, warnings }
}

// ---------------------------------------------------------------------------
// Fabricated base entry — only the transit-papers fields vary per test
// ---------------------------------------------------------------------------

const baseEntry: Partial<TrackerRegistryEntry> = {
  slug: "fake-tracker",
  name: "Fake Tracker",
  supportsTransitPapers: undefined,
  profileUrlPattern: undefined,
}

const liveEntry: Partial<TrackerRegistryEntry> = {
  slug: "fake-tracker",
  name: "Fake Tracker",
}

const defunctEntry: Partial<TrackerRegistryEntry> = {
  ...liveEntry,
  defunct: true,
  defunctMessage: "Fake Tracker has shut down.",
  defunctDate: "2026-05-11",
  defunctLink: "https://example.com/announcement",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("transit papers validation", () => {
  it("supportsTransitPapers=true without profileUrlPattern produces an error", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: true,
      profileUrlPattern: undefined,
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toContain("supportsTransitPapers is true but profileUrlPattern is missing")
    expect(warnings).toHaveLength(0)
  })

  it("profileUrlPattern missing {id} and {username} produces an error", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: true,
      profileUrlPattern: "https://example.com/user",
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/must contain \{id\} or \{username\}/)
    expect(errors[0]).toContain("https://example.com/user")
    expect(warnings).toHaveLength(0)
  })

  it("profileUrlPattern defined without supportsTransitPapers produces a warning not an error", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: undefined,
      profileUrlPattern: "https://example.com/user/{username}",
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(0)
    expect(warnings).toContain("profileUrlPattern defined but supportsTransitPapers is not true")
  })

  it("profileUrlPattern defined with supportsTransitPapers=false produces a warning not an error", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: false,
      profileUrlPattern: "https://example.com/user/{username}",
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(0)
    expect(warnings).toContain("profileUrlPattern defined but supportsTransitPapers is not true")
  })

  it("valid config with {username} placeholder produces no errors and no warnings", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: true,
      profileUrlPattern: "https://example.com/user/{username}",
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it("profileUrlPattern with {id} placeholder is valid", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: true,
      profileUrlPattern: "https://example.com/user/{id}",
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it("no transit papers fields at all produces no errors and no warnings", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: undefined,
      profileUrlPattern: undefined,
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })
})

describe("defunct validation", () => {
  it("a fully populated defunct entry produces no errors and no warnings", () => {
    const { errors, warnings } = validateDefunct(defunctEntry)

    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it("an ordinary live tracker produces no errors and no warnings", () => {
    const { errors, warnings } = validateDefunct(liveEntry)

    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  // The banner leads with the shutdown date, so a defunct entry without one renders
  // an announcement that never says when — which reads as a bug, not as missing data.
  it("defunct=true without defunctDate produces an error", () => {
    const { errors } = validateDefunct({ ...defunctEntry, defunctDate: undefined })

    expect(errors).toContain("defunct is true but defunctDate is missing")
  })

  it("defunct=true with an empty defunctDate produces an error", () => {
    const { errors } = validateDefunct({ ...defunctEntry, defunctDate: "   " })

    expect(errors).toContain("defunct is true but defunctDate is missing")
  })

  it("defunct=true without defunctMessage produces an error", () => {
    const { errors } = validateDefunct({ ...defunctEntry, defunctMessage: undefined })

    expect(errors).toContain("defunct is true but defunctMessage is missing")
  })

  // A free-form display string is the tempting alternative (stats.statsUpdatedAt is one),
  // but the UI parses this field, and "May 2026" parses to Invalid Date.
  it("a free-form defunctDate produces an error", () => {
    const { errors } = validateDefunct({ ...defunctEntry, defunctDate: "May 11 2026" })

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/defunctDate must be "YYYY-MM-DD"/)
    expect(errors[0]).toContain("May 11 2026")
  })

  it("a well-shaped but impossible defunctDate produces an error", () => {
    const { errors } = validateDefunct({ ...defunctEntry, defunctDate: "2026-02-31" })

    expect(errors).toEqual(['defunctDate "2026-02-31" is not a real calendar date'])
  })

  it("a non-https defunctLink produces an error", () => {
    const { errors } = validateDefunct({
      ...defunctEntry,
      defunctLink: "http://example.com/announcement",
    })

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/defunctLink must use https:\/\//)
  })

  it("a defunct entry with no defunctLink is valid — the link is optional", () => {
    const { errors, warnings } = validateDefunct({ ...defunctEntry, defunctLink: undefined })

    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  // Warn, not error: this is most likely a half-finished edit rather than broken data,
  // and the fields are inert until `defunct` is set.
  it("defunct details set without defunct=true produce warnings, not errors", () => {
    const { errors, warnings } = validateDefunct({ ...defunctEntry, defunct: false })

    expect(errors).toHaveLength(0)
    expect(warnings).toEqual([
      "defunctMessage is set but defunct is not true",
      "defunctLink is set but defunct is not true",
      "defunctDate is set but defunct is not true",
    ])
  })
})
