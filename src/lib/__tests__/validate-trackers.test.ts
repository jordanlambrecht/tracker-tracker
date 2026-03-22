// src/lib/__tests__/validate-trackers.test.ts
//
// Functions:
//   - describe("transit papers validation")

import { describe, expect, it } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"

// ---------------------------------------------------------------------------
// Local mirror of the transit-papers validation logic from
// scripts/validate-trackers.ts. Do NOT import that script directly — it runs
// CLI side-effects (process.exit, console.log) on module load.
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
        errors.push(
          `profileUrlPattern must contain {id} or {username} (got "${pattern}")`
        )
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
    expect(warnings).toContain(
      "profileUrlPattern defined but supportsTransitPapers is not true"
    )
  })

  it("profileUrlPattern defined with supportsTransitPapers=false produces a warning not an error", () => {
    const entry: Partial<TrackerRegistryEntry> = {
      ...baseEntry,
      supportsTransitPapers: false,
      profileUrlPattern: "https://example.com/user/{username}",
    }

    const { errors, warnings } = validateTransitPapers(entry)

    expect(errors).toHaveLength(0)
    expect(warnings).toContain(
      "profileUrlPattern defined but supportsTransitPapers is not true"
    )
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
