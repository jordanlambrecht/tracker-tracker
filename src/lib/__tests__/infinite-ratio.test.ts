// src/lib/__tests__/infinite-ratio.test.ts
//
// Regression coverage for the infinite-ratio cluster: issues #172 (UNIT3D
// sends "∞") and #154 (MAM), plus the unreported case where DigitalCore and
// Nebulance accounts with zero download rendered as "Offline" because
// JSON.stringify(Infinity) is null.

import { describe, expect, it } from "vitest"
import { computeRatio } from "@/lib/data-transforms"

describe("computeRatio", () => {
  it("returns Infinity for uploads with zero downloads", () => {
    expect(computeRatio(1000n, 0n)).toBe(Infinity)
  })

  it("returns 0 for a brand new account with no traffic at all", () => {
    expect(computeRatio(0n, 0n)).toBe(0)
  })

  it("computes a normal ratio", () => {
    expect(computeRatio(1000n, 500n)).toBe(2)
  })

  it("is immune to however the site encodes an infinite ratio", () => {
    // The whole point: UNIT3D sends "∞", Gazelle sends -1, MAM is
    // undocumented. None of those reach this function.
    expect(computeRatio(123n * 1024n ** 3n, 0n)).toBe(Infinity)
  })
})

describe("infinite ratio survives JSON serialization", () => {
  it("loses Infinity through JSON, which is why the flag exists", () => {
    // Documents the root cause rather than asserting a behaviour we control.
    expect(JSON.parse(JSON.stringify({ ratio: Infinity })).ratio).toBeNull()
  })

  it("a zero-download account is distinguishable from one with no data", () => {
    // Mirrors what tracker-serializer emits for a snapshot.
    const serialize = (uploaded: bigint, downloaded: bigint) => {
      const ratio = computeRatio(uploaded, downloaded)
      return {
        ratio: Number.isFinite(ratio) ? ratio : null,
        ratioIsInfinite: downloaded === 0n && uploaded > 0n,
      }
    }

    const infinite = serialize(1000n, 0n)
    const noData = { ratio: null, ratioIsInfinite: false }

    // Both carry ratio: null over the wire...
    expect(infinite.ratio).toBeNull()
    expect(noData.ratio).toBeNull()
    // ...and the flag is the only thing telling them apart.
    expect(infinite.ratioIsInfinite).toBe(true)
    expect(noData.ratioIsInfinite).toBe(false)
  })
})
