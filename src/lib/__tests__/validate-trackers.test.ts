// src/lib/__tests__/validate-trackers.test.ts
//
// Functions:
//   - describe("transit papers validation")
//   - describe("user class ladder validation")
//   - describe("defunct validation")

import { describe, expect, it } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { validateDefunct } from "@/data/tracker-validation-rules"

// ---------------------------------------------------------------------------
// Local mirror of the transit-papers rule in scripts/validate-trackers.ts,
// which calls process.exit on import. The defunct rule needs no mirror, since it
// lives in src/data/tracker-validation-rules.ts and is tested directly.
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

// Local mirror of the user-class ladder rules from scripts/validate-trackers.ts,
// which src/data/__tests__/tracker-registry.test.ts asserts over the shipped
// registry. Same reason as above: the script cannot be imported.
function validateUserClasses(userClasses: TrackerRegistryEntry["userClasses"]): string[] {
  const errors: string[] = []

  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const cls of userClasses) {
    const key = cls.name.toLowerCase()
    if (seen.has(key)) dupes.add(cls.name)
    else seen.add(key)
  }
  if (dupes.size > 0) errors.push(`Duplicate user classes: ${[...dupes].join(", ")}`)

  // A ladder whose every class is flagged drops the tracker out of the Ranks
  // section with no signal on the page.
  if (userClasses.length > 0 && !userClasses.some((c) => !c.outsideLadder)) {
    errors.push("userClasses must include at least one class without outsideLadder")
  }

  return errors
}

// ---------------------------------------------------------------------------
// Fabricated base entry, only the transit-papers fields vary per test
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

describe("user class ladder validation", () => {
  it("a ladder that names each class once produces no errors", () => {
    const errors = validateUserClasses([
      { name: "User" },
      { name: "Power User" },
      { name: "Donor", outsideLadder: "above" },
    ])

    expect(errors).toHaveLength(0)
  })

  it("a class listed twice produces an error", () => {
    const errors = validateUserClasses([{ name: "User" }, { name: "Elite" }, { name: "Elite" }])

    expect(errors).toEqual(["Duplicate user classes: Elite"])
  })

  it("a class repeated in another casing produces an error", () => {
    const errors = validateUserClasses([{ name: "Power User" }, { name: "power user" }])

    expect(errors).toEqual(["Duplicate user classes: power user"])
  })

  it("a ladder whose every class is flagged outsideLadder produces an error", () => {
    const errors = validateUserClasses([
      { name: "Donor", outsideLadder: "above" },
      { name: "Banned", outsideLadder: "below" },
    ])

    expect(errors).toEqual(["userClasses must include at least one class without outsideLadder"])
  })

  it("an empty userClasses list produces no errors, because absence is a warning", () => {
    expect(validateUserClasses([])).toHaveLength(0)
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
  // an announcement that never says when, which reads as a bug, not as missing data.
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

  // The UI parses this field, and a free-form string like "May 2026" parses to
  // Invalid Date.
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

  it("a defunct entry with no defunctLink is valid, the link is optional", () => {
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
