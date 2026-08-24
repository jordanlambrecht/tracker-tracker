// src/lib/satisfaction.test.ts

import { describe, expect, it } from "vitest"
import type { TrackerRules } from "@/data/tracker-registry"
import {
  isSatisfied,
  ratioProgress,
  remainingSeedSeconds,
  resolveSatisfaction,
  type SatisfactionRequirement,
  satisfactionProgress,
  seedTimeProgress,
} from "./satisfaction"

const HOUR = 3600

function rules(overrides: Partial<TrackerRules> = {}): TrackerRules {
  return { minimumRatio: 0, seedTimeHours: 0, loginIntervalDays: 0, ...overrides }
}

function torrent(seedingTime: number, ratio: number) {
  return { seedingTime, ratio }
}

describe("resolveSatisfaction", () => {
  it("returns null when the tracker states no requirement", () => {
    expect(resolveSatisfaction(rules())).toBeNull()
    expect(resolveSatisfaction(undefined)).toBeNull()
  })

  it("ignores minimumRatio for an entry that declares no mode", () => {
    // The compatibility guarantee. minimumRatio has always been an ACCOUNT-level
    // figure here; reading it per-torrent for the 55 entries that predate this
    // field would re-interpret rules nobody has re-read.
    const req = resolveSatisfaction(rules({ minimumRatio: 1.0, seedTimeHours: 72 }))
    expect(req).toEqual({ requiredSeedSeconds: 72 * HOUR, requiredRatio: null, mode: "all" })
  })

  it("returns null for a ratio-only entry that has not opted in", () => {
    expect(resolveSatisfaction(rules({ minimumRatio: 1.0 }))).toBeNull()
  })

  it("picks up ratio once a mode is declared", () => {
    const req = resolveSatisfaction(
      rules({ minimumRatio: 1.0, seedTimeHours: 240, satisfactionMode: "any" })
    )
    expect(req).toEqual({ requiredSeedSeconds: 240 * HOUR, requiredRatio: 1.0, mode: "any" })
  })

  it("allows a ratio-only rule when the mode is declared", () => {
    const req = resolveSatisfaction(rules({ minimumRatio: 1.0, satisfactionMode: "any" }))
    expect(req).toEqual({ requiredSeedSeconds: null, requiredRatio: 1.0, mode: "any" })
  })

  it("returns null for a declared mode over no thresholds at all", () => {
    expect(resolveSatisfaction(rules({ satisfactionMode: "any" }))).toBeNull()
  })
})

describe("either/or satisfaction", () => {
  const req: SatisfactionRequirement = {
    requiredSeedSeconds: 240 * HOUR,
    requiredRatio: 1.0,
    mode: "any",
  }

  it("satisfies on ratio alone with no seed time", () => {
    expect(isSatisfied(torrent(0, 1.2), req)).toBe(true)
  })

  it("satisfies on seed time alone with a ratio of zero", () => {
    expect(isSatisfied(torrent(240 * HOUR, 0), req)).toBe(true)
  })

  it("leaves a torrent short on both unsatisfied", () => {
    expect(isSatisfied(torrent(100 * HOUR, 0.5), req)).toBe(false)
  })

  it("satisfies at exactly the ratio threshold", () => {
    expect(isSatisfied(torrent(0, 1.0), req)).toBe(true)
  })

  it("reports progress as the nearer of the two routes", () => {
    // 25% of the seed time but 90% of the ratio: an hour of seeding could clear
    // it, so it is 90% done, not 25%.
    expect(satisfactionProgress(torrent(60 * HOUR, 0.9), req)).toBeCloseTo(0.9)
  })
})

describe("all-of satisfaction", () => {
  const req: SatisfactionRequirement = {
    requiredSeedSeconds: 72 * HOUR,
    requiredRatio: 1.0,
    mode: "all",
  }

  it("is unsatisfied when only the ratio is met", () => {
    expect(isSatisfied(torrent(0, 5.0), req)).toBe(false)
  })

  it("is unsatisfied when only the seed time is met", () => {
    expect(isSatisfied(torrent(100 * HOUR, 0.2), req)).toBe(false)
  })

  it("is satisfied when both are met", () => {
    expect(isSatisfied(torrent(100 * HOUR, 1.5), req)).toBe(true)
  })

  it("reports progress as the laggard", () => {
    expect(satisfactionProgress(torrent(72 * HOUR, 0.3), req)).toBeCloseTo(0.3)
  })
})

describe("seed-time-only satisfaction (the historical behaviour)", () => {
  const req: SatisfactionRequirement = {
    requiredSeedSeconds: 72 * HOUR,
    requiredRatio: null,
    mode: "all",
  }

  it("ignores ratio entirely", () => {
    expect(isSatisfied(torrent(72 * HOUR, 0), req)).toBe(true)
    expect(isSatisfied(torrent(71 * HOUR, 99), req)).toBe(false)
  })
})

describe("single-route satisfaction", () => {
  // Only the routes a tracker actually states may count. An absent route scores
  // 1 so it cannot hold back an "all", but reading that 1 as a met route under
  // "any" satisfies every torrent on a tracker whose only route is ratio.
  const ratioOnlyAny: SatisfactionRequirement = {
    requiredSeedSeconds: null,
    requiredRatio: 1.0,
    mode: "any",
  }

  it("does not satisfy a low-ratio torrent on a ratio-only any tracker", () => {
    expect(isSatisfied(torrent(0, 0.01), ratioOnlyAny)).toBe(false)
    expect(satisfactionProgress(torrent(0, 0.01), ratioOnlyAny)).toBeCloseTo(0.01)
  })

  it("satisfies once the ratio is met on a ratio-only any tracker", () => {
    expect(isSatisfied(torrent(0, 1.0), ratioOnlyAny)).toBe(true)
  })

  it("reads the same under any and all when there is one route", () => {
    const asAll: SatisfactionRequirement = { ...ratioOnlyAny, mode: "all" }
    for (const ratio of [0, 0.5, 0.99, 1, 3]) {
      expect(
        satisfactionProgress(torrent(0, ratio), ratioOnlyAny),
        `ratio ${ratio}`
      ).toBe(satisfactionProgress(torrent(0, ratio), asAll))
    }
  })

  it("ignores ratio on a seed-time-only any tracker", () => {
    const seedOnlyAny: SatisfactionRequirement = {
      requiredSeedSeconds: 72 * HOUR,
      requiredRatio: null,
      mode: "any",
    }
    expect(isSatisfied(torrent(0, 99), seedOnlyAny)).toBe(false)
    expect(isSatisfied(torrent(72 * HOUR, 0), seedOnlyAny)).toBe(true)
  })
})

describe("ratioProgress", () => {
  const req: SatisfactionRequirement = {
    requiredSeedSeconds: null,
    requiredRatio: 1.0,
    mode: "any",
  }

  it("treats an infinite ratio as no progress, not as complete", () => {
    // A torrent that has downloaded nothing reports Infinity in some clients.
    // Reading that as "1000% of the requirement" would mark it satisfied, which
    // is the unsafe direction — this is exactly how the TorrentLeech adapter's
    // zero-download parse would have poisoned the table.
    expect(ratioProgress(Number.POSITIVE_INFINITY, req)).toBe(0)
  })

  it("treats a negative sentinel ratio as no progress", () => {
    // Transmission uses -1 for "not applicable".
    expect(ratioProgress(-1, req)).toBe(0)
  })

  it("treats NaN as no progress", () => {
    expect(ratioProgress(Number.NaN, req)).toBe(0)
  })

  it("caps at 1", () => {
    expect(ratioProgress(50, req)).toBe(1)
  })

  it("is 1 when ratio is not required", () => {
    expect(ratioProgress(0, { requiredSeedSeconds: HOUR, requiredRatio: null, mode: "all" })).toBe(1)
  })
})

describe("seedTimeProgress", () => {
  const req: SatisfactionRequirement = {
    requiredSeedSeconds: 100,
    requiredRatio: null,
    mode: "all",
  }

  it("is a fraction of the requirement", () => {
    expect(seedTimeProgress(25, req)).toBeCloseTo(0.25)
  })

  it("caps at 1", () => {
    expect(seedTimeProgress(1000, req)).toBe(1)
  })

  it("is 1 when seed time is not required", () => {
    expect(
      seedTimeProgress(0, { requiredSeedSeconds: null, requiredRatio: 1, mode: "any" })
    ).toBe(1)
  })
})

describe("remainingSeedSeconds", () => {
  const req: SatisfactionRequirement = {
    requiredSeedSeconds: 240 * HOUR,
    requiredRatio: 1.0,
    mode: "any",
  }

  it("reports what is still owed", () => {
    expect(remainingSeedSeconds(torrent(40 * HOUR, 0.1), req)).toBe(200 * HOUR)
  })

  it("reports null once the torrent is satisfied by ratio", () => {
    // Not "200 hours remaining". Nothing is owed — the torrent is free to go.
    expect(remainingSeedSeconds(torrent(40 * HOUR, 1.5), req)).toBeNull()
  })

  it("reports null when seed time is not a route here", () => {
    expect(
      remainingSeedSeconds(torrent(0, 0.5), {
        requiredSeedSeconds: null,
        requiredRatio: 1,
        mode: "any",
      })
    ).toBeNull()
  })
})

describe("TorrentLeech, end to end", () => {
  // The case that motivated this: seedTimeHours was 0, so the whole unsatisfied
  // table silently disappeared for TorrentLeech.
  it("produces a real requirement from the registry entry", async () => {
    const { getTrackerBySlug } = await import("@/data/tracker-registry")
    const tl = getTrackerBySlug("torrentleech")
    expect(tl, "torrentleech is in the registry").toBeDefined()

    const req = resolveSatisfaction(tl?.rules)
    expect(req).not.toBeNull()
    expect(req?.mode).toBe("any")
    expect(req?.requiredRatio).toBe(1.0)
    expect(req?.requiredSeedSeconds).toBe(240 * HOUR)
  })
})
