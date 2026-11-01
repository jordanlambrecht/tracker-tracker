// src/lib/__tests__/validate-trackers.test.ts
//
// Functions:
//   - describe("transit papers validation")
//   - describe("user class ladder validation")
//   - describe("defunct validation")
//   - describe("announce hosts validation")
//   - describe("previous hosts validation")
//   - describe("shared hosts")
//   - describe("url validation")

import { describe, expect, it } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import {
  findSharedHosts,
  validateAnnounceHosts,
  validateDefunct,
  validatePreviousHosts,
  validateTrackerUrl,
} from "@/data/tracker-validation-rules"

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

describe("announce hosts validation", () => {
  it("registrable domains produce no errors", () => {
    expect(validateAnnounceHosts({ announceHosts: ["flacsfor.me", "alpha.co.uk"] })).toEqual([])
  })

  // Most entries leave the field out, so the empty check must not see a default [].
  it("an absent field produces no errors", () => {
    expect(validateAnnounceHosts({})).toEqual([])
  })

  it("an empty list produces an error", () => {
    expect(validateAnnounceHosts({ announceHosts: [] })).toEqual([
      "announceHosts is empty, so leave it out until someone checks where torrents announce",
    ])
  })

  // The matcher would accept either form, so this rule is all that stops a
  // passkey being merged, and the CI comment must not print it.
  const passkey = "0123456789abcdef0123456789abcdef"
  it.each([
    ["an announce URL", `https://flacsfor.me/${passkey}/announce`],
    ["a passkey subdomain", `${passkey}.flacsfor.me`],
  ])("%s produces an error that names its index, not its value", (_form, host) => {
    expect(validateAnnounceHosts({ announceHosts: ["flacsfor.me", host] })).toEqual([
      "announceHosts[1] must be a lowercase registrable domain, never a URL or subdomain",
    ])
  })

  // The matcher keeps both whole, so only this rule turns them away.
  it.each([
    ["an IP address", "203.0.113.5"],
    ["a local name", "seedbox.local"],
  ])("%s produces an error that names its index", (_form, host) => {
    expect(validateAnnounceHosts({ announceHosts: ["flacsfor.me", host] })).toEqual([
      "announceHosts[1] must be a lowercase registrable domain, never a URL or subdomain",
    ])
  })
})

describe("previous hosts validation", () => {
  const moved: Partial<TrackerRegistryEntry> = { url: "https://www.new-home.example" }

  it("registrable domains other than the url's produce no errors", () => {
    expect(
      validatePreviousHosts({ ...moved, previousHosts: ["old-home.example", "older.co.uk"] })
    ).toEqual([])
  })

  it("an absent field produces no errors", () => {
    expect(validatePreviousHosts(moved)).toEqual([])
  })

  it("an empty list produces an error", () => {
    expect(validatePreviousHosts({ ...moved, previousHosts: [] })).toEqual([
      "previousHosts is empty, so leave it out",
    ])
  })

  // Attribution reduces these to registrable domains too, so the announceHosts
  // rule applies, passkey subdomain included.
  it.each([
    ["a URL", "https://old-home.example"],
    ["a subdomain", "tracker.old-home.example"],
    ["an uppercase domain", "Old-Home.example"],
    ["an IP address", "203.0.113.5"],
    ["a local name", "seedbox.local"],
  ])("%s produces an error that names its index, not its value", (_form, host) => {
    expect(validatePreviousHosts({ ...moved, previousHosts: ["old-home.example", host] })).toEqual([
      "previousHosts[1] must be a lowercase registrable domain, never a URL or subdomain",
    ])
  })

  // Compared without the url's www., the way the backfill reads a stored address.
  it("the host of the entry's own url produces an error", () => {
    expect(validatePreviousHosts({ ...moved, previousHosts: ["new-home.example"] })).toEqual([
      "previousHosts[0] is the host of this entry's own url",
    ])
  })
})

describe("shared hosts", () => {
  const entry = (slug: string, url: string, hosts: Partial<TrackerRegistryEntry> = {}) =>
    ({ slug, url, ...hosts }) as TrackerRegistryEntry
  const home = entry("home", "https://home.example", { announceHosts: ["home-cdn.example"] })

  it.each([
    ["the url host of another entry", "home.example"],
    ["an announce host of another entry", "home-cdn.example"],
  ])("reports a previous host that is %s", (_where, host) => {
    const moved = entry("moved", "https://moved.example", { previousHosts: [host] })

    expect(findSharedHosts([home, moved])).toEqual([{ host, slugs: ["home", "moved"] }])
  })

  it("reports an announce host that is the url host of another entry", () => {
    const other = entry("other", "https://other.example", { announceHosts: ["home.example"] })

    expect(findSharedHosts([home, other])).toEqual([
      { host: "home.example", slugs: ["home", "other"] },
    ])
  })

  it("lets an entry list one of its own announce hosts as a previous host", () => {
    const moved = entry("moved", "https://moved.example", {
      announceHosts: ["old-moved.example"],
      previousHosts: ["old-moved.example"],
    })

    expect(findSharedHosts([home, moved])).toEqual([])
  })
})

describe("url validation", () => {
  it.each([
    ["a bare host", "https://tracker.example"],
    ["a www host", "https://www.tracker.example"],
  ])("%s produces no errors", (_form, url) => {
    expect(validateTrackerUrl(url)).toEqual([])
  })

  it.each([
    ["a path", "https://tracker.example/forum"],
    ["a trailing slash", "https://tracker.example/"],
    ["an uppercase host", "https://Tracker.example"],
    ["an explicit default port", "https://tracker.example:443"],
    ["another port", "https://tracker.example:8443"],
    ["a query", "https://tracker.example?lang=en"],
    ["a fragment", "https://tracker.example#top"],
    ["credentials", "https://user:pass@tracker.example"],
    ["a trailing dot", "https://tracker.example."],
  ])("%s produces an error naming the origin it should be", (_form, url) => {
    expect(validateTrackerUrl(url)).toEqual([
      `URL must be exactly its origin (got "${url}", expected "https://tracker.example")`,
    ])
  })

  it("an http URL produces the https error", () => {
    expect(validateTrackerUrl("http://tracker.example")).toEqual(["URL must use https://"])
  })

  it("a URL that does not parse produces the format error", () => {
    expect(validateTrackerUrl("https://")).toEqual(["Invalid URL format"])
  })

  // Each is otherwise exactly its origin, so only the address check refuses it.
  it.each([
    ["a private IPv4 address", "https://10.0.0.5"],
    ["localhost", "https://localhost"],
    ["a home network address", "https://192.168.1.1"],
  ])("%s produces the private address error", (_form, url) => {
    expect(validateTrackerUrl(url)).toEqual(["URL must not be a private or local address"])
  })
})
