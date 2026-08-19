// src/lib/__tests__/outages.test.ts
//
// The band math is where this feature either explains a flat chart or lies about
// one, so it is tested exhaustively and in isolation: no DB, no clock, no React.
//
// The rules under test, restated:
//   - qBT-down comes ONLY from positive evidence (ok === 0 && fail > 0)
//   - inside a recorded app gap, qBT is UNKNOWN and is never drawn
//   - absence of evidence draws nothing at all
//   - bands are clamped to what could be observed, and never to the open present
//   - anything under 5 minutes is dropped
//   - tracker-down is positive evidence too, and yields to a recorded app gap by
//     the same subtraction qBT does

import { describe, expect, it } from "vitest"
import {
  BUCKET_MS,
  bucketsToDownIntervals,
  clampIntervals,
  computeOutageBands,
  filterMinDuration,
  floorToBucketMs,
  type Interval,
  intersectAll,
  MIN_BAND_MS,
  mergeIntervals,
  subtractIntervals,
  type UptimeBucket,
} from "@/lib/outages"

// A fixed origin on a 5-minute boundary. All times are "minutes after T0".
const T0 = Date.UTC(2026, 7, 1, 0, 0, 0)
/** Minutes after T0, in epoch ms. */
const m = (minutes: number): number => T0 + minutes * 60_000
const span = (startMin: number, endMin: number): Interval => ({
  start: m(startMin),
  end: m(endMin),
})
/** Render an interval list as "0-10,20-25" minute offsets for readable failures. */
const fmt = (list: Interval[]): string =>
  list.map((i) => `${(i.start - T0) / 60_000}-${(i.end - T0) / 60_000}`).join(",")

/** A run of consecutive buckets from `startMin`, one entry per 5 minutes. */
function buckets(startMin: number, states: Array<[ok: number, fail: number]>): UptimeBucket[] {
  return states.map(([ok, fail], i) => ({
    bucketTs: m(startMin) + i * BUCKET_MS,
    ok,
    fail,
  }))
}

describe("floorToBucketMs", () => {
  it.each([
    ["exact boundary", m(5), m(5)],
    ["mid bucket", m(7), m(5)],
    ["one ms before the next boundary", m(10) - 1, m(5)],
    ["origin", T0, T0],
  ])("%s", (_label, input, expected) => {
    expect(floorToBucketMs(input)).toBe(expected)
  })
})

describe("mergeIntervals", () => {
  const cases: Array<[string, Interval[], string]> = [
    ["empty stays empty", [], ""],
    ["drops zero-length spans", [span(0, 0)], ""],
    ["drops inverted spans", [span(10, 5)], ""],
    ["sorts out-of-order input", [span(20, 30), span(0, 10)], "0-10,20-30"],
    ["merges overlap", [span(0, 10), span(5, 20)], "0-20"],
    ["merges adjacency — two touching buckets are ONE outage", [span(0, 5), span(5, 10)], "0-10"],
    ["merges containment", [span(0, 60), span(10, 20)], "0-60"],
    ["leaves a real separation alone", [span(0, 10), span(11, 20)], "0-10,11-20"],
  ]
  it.each(cases)("%s", (_label, input, expected) => {
    expect(fmt(mergeIntervals(input))).toBe(expected)
  })

  it("does not mutate its input", () => {
    const input = [span(0, 10), span(5, 20)]
    const before = JSON.stringify(input)
    mergeIntervals(input)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe("subtractIntervals", () => {
  const cases: Array<[string, Interval[], Interval[], string]> = [
    ["nothing to cut", [span(0, 10)], [], "0-10"],
    ["cut swallows base entirely", [span(10, 20)], [span(0, 60)], ""],
    ["cut exactly equals base", [span(10, 20)], [span(10, 20)], ""],
    ["cut trims the leading edge", [span(10, 30)], [span(0, 20)], "20-30"],
    ["cut trims the trailing edge", [span(10, 30)], [span(20, 60)], "10-20"],
    ["cut punches a hole in the middle", [span(0, 60)], [span(20, 30)], "0-20,30-60"],
    ["adjacent cut removes nothing", [span(10, 20)], [span(0, 10), span(20, 30)], "10-20"],
    ["multiple cuts", [span(0, 60)], [span(10, 20), span(30, 40)], "0-10,20-30,40-60"],
  ]
  it.each(cases)("%s", (_label, base, cut, expected) => {
    expect(fmt(subtractIntervals(base, cut))).toBe(expected)
  })
})

describe("intersectAll", () => {
  it("returns nothing for an empty list of clients — no clients means nothing known", () => {
    expect(intersectAll([])).toEqual([])
  })

  it("returns the single list unchanged when there is one client", () => {
    expect(fmt(intersectAll([[span(0, 10)]]))).toBe("0-10")
  })

  it("keeps only the window where BOTH clients were down", () => {
    expect(fmt(intersectAll([[span(0, 20)], [span(10, 30)]]))).toBe("10-20")
  })

  it("is empty when one client has no down intervals at all", () => {
    expect(intersectAll([[span(0, 20)], []])).toEqual([])
  })

  it("handles three clients with a common core", () => {
    expect(fmt(intersectAll([[span(0, 40)], [span(10, 40)], [span(10, 30)]]))).toBe("10-30")
  })
})

describe("clampIntervals", () => {
  const cases: Array<[string, Interval[], Interval, string]> = [
    ["wholly inside is untouched", [span(10, 20)], span(0, 60), "10-20"],
    ["wholly outside is dropped", [span(70, 80)], span(0, 60), ""],
    ["clipped at the left edge", [span(-10, 10)], span(0, 60), "0-10"],
    ["clipped at the right edge", [span(50, 90)], span(0, 60), "50-60"],
    ["clipped at both edges", [span(-10, 90)], span(0, 60), "0-60"],
    ["touching the bound but not overlapping is dropped", [span(60, 70)], span(0, 60), ""],
  ]
  it.each(cases)("%s", (_label, list, bound, expected) => {
    expect(fmt(clampIntervals(list, bound))).toBe(expected)
  })
})

describe("filterMinDuration", () => {
  it("keeps a band exactly at the threshold", () => {
    expect(filterMinDuration([span(0, 5)], MIN_BAND_MS)).toHaveLength(1)
  })
  it("drops a band one millisecond under the threshold", () => {
    const almost = [{ start: m(0), end: m(5) - 1 }]
    expect(filterMinDuration(almost, MIN_BAND_MS)).toHaveLength(0)
  })
})

describe("bucketsToDownIntervals — positive evidence only", () => {
  it("a fully failed bucket is down for its whole 5 minutes", () => {
    expect(fmt(bucketsToDownIntervals(buckets(0, [[0, 12]])))).toBe("0-5")
  })

  it("a healthy bucket draws nothing", () => {
    expect(bucketsToDownIntervals(buckets(0, [[12, 0]]))).toEqual([])
  })

  it("a MIXED bucket is degraded, not down — it draws nothing", () => {
    expect(bucketsToDownIntervals(buckets(0, [[6, 6]]))).toEqual([])
  })

  it("an all-zero bucket draws nothing — no observation is not an observation", () => {
    expect(bucketsToDownIntervals(buckets(0, [[0, 0]]))).toEqual([])
  })

  it("consecutive failed buckets merge into one continuous band", () => {
    expect(
      fmt(
        bucketsToDownIntervals(
          buckets(0, [
            [0, 12],
            [0, 12],
            [0, 12],
          ])
        )
      )
    ).toBe("0-15")
  })

  it("a MISSING bucket splits the band — the hole is UNKNOWN, not down", () => {
    // 0-5 failed, 5-10 has no row at all, 10-15 failed.
    const withHole: UptimeBucket[] = [
      { bucketTs: m(0), ok: 0, fail: 12 },
      { bucketTs: m(10), ok: 0, fail: 12 },
    ]
    expect(fmt(bucketsToDownIntervals(withHole))).toBe("0-5,10-15")
  })
})

// ── The whole pipeline ───────────────────────────────────────────────────────

/** A generous window and coverage, so individual cases only vary what matters. */
const WIDE = span(-600, 600)

function bands(
  overrides: Partial<Parameters<typeof computeOutageBands>[0]> = {}
): ReturnType<typeof computeOutageBands> {
  return computeOutageBands({
    window: WIDE,
    appGaps: [],
    clients: [],
    trackerOutages: [],
    appCoverage: WIDE,
    qbtCoverage: WIDE,
    ...overrides,
  })
}

describe("computeOutageBands — tracker bands", () => {
  it("draws a recorded tracker outage", () => {
    expect(fmt(bands({ trackerOutages: [span(0, 30)] }).tracker)).toBe("0-30")
  })

  it("draws nothing when none was recorded — UNKNOWN, not healthy", () => {
    // The circuit breaker stops polling after four failures, so the pause that
    // follows arrives here as an absence. It must stay blank rather than
    // inheriting a band nobody observed.
    expect(bands().tracker).toEqual([])
  })

  it("leaves a chart with no trackerId scope completely unbanded", () => {
    // The dashboard never sends a trackerId, so this arm is always [] there.
    expect(bands({ appGaps: [span(0, 30)] }).tracker).toEqual([])
  })

  it("drops a zero-length row, which is what a lone failure records", () => {
    expect(bands({ trackerOutages: [{ start: m(0), end: m(0) }] }).tracker).toEqual([])
  })

  it("drops an outage under five minutes", () => {
    expect(bands({ trackerOutages: [{ start: m(0), end: m(5) - 1 }] }).tracker).toEqual([])
  })

  it("keeps an outage of exactly five minutes", () => {
    expect(fmt(bands({ trackerOutages: [span(0, 5)] }).tracker)).toBe("0-5")
  })

  it("YIELDS ENTIRELY to an app gap that swallows it — app outage always wins", () => {
    // Nothing was polling, so the tracker's reachability was not observed. The
    // narrower claim is REMOVED, not painted under.
    const result = bands({ appGaps: [span(0, 60)], trackerOutages: [span(10, 40)] })
    expect(result.tracker).toEqual([])
    expect(fmt(result.app)).toBe("0-60")
  })

  it("keeps the part of an outage that lies outside the app gap", () => {
    const result = bands({ appGaps: [span(0, 30)], trackerOutages: [span(10, 90)] })
    expect(fmt(result.tracker)).toBe("30-90")
  })

  it("subtracts BEFORE the minimum-duration filter, so a sliver does not survive", () => {
    // 0-34 minus 0-30 leaves four minutes. Filtering first would have kept the
    // whole 34-minute span and then drawn a four-minute remnant.
    const result = bands({ appGaps: [span(0, 30)], trackerOutages: [span(0, 34)] })
    expect(result.tracker).toEqual([])
  })

  it("draws nothing at all when the app ledger has never been written", () => {
    // The app's poller is the only thing that ever observed this tracker, so
    // outside what that ledger can speak for there is no claim to make.
    expect(bands({ trackerOutages: [span(0, 30)], appCoverage: null }).tracker).toEqual([])
  })

  it("clamps to firstSeenAt — history before instrumentation is never banded", () => {
    const result = bands({ trackerOutages: [span(-100, 30)], appCoverage: span(0, 600) })
    expect(fmt(result.tracker)).toBe("0-30")
  })

  it("merges two adjacent rows into one band", () => {
    // Consecutive failures can land in separate rows across a restart. They are
    // one outage, not two.
    const result = bands({ trackerOutages: [span(0, 15), span(15, 30)] })
    expect(fmt(result.tracker)).toBe("0-30")
  })

  it("crops to the visible window LAST, so a long outage still shows its edge", () => {
    const result = bands({
      window: span(0, 120),
      trackerOutages: [span(-600, 2)],
      appCoverage: span(-1000, 600),
    })
    expect(fmt(result.tracker)).toBe("0-2")
  })

  it("is independent of qBT evidence in both directions", () => {
    // A tracker outage must not imply a client one, nor be implied by it.
    const clientDown = bands({
      clients: [{ clientId: 1, buckets: buckets(0, [[0, 3], [0, 3]]) }],
    })
    expect(clientDown.tracker).toEqual([])
    expect(fmt(clientDown.allDown)).toBe("0-10")

    const trackerDown = bands({ trackerOutages: [span(0, 30)] })
    expect(trackerDown.allDown).toEqual([])
    expect(fmt(trackerDown.tracker)).toBe("0-30")
  })

  it("returns an empty tracker arm for an unusable window", () => {
    expect(computeOutageBands({
      window: { start: m(10), end: m(10) },
      appGaps: [],
      clients: [],
      trackerOutages: [span(0, 30)],
      appCoverage: WIDE,
      qbtCoverage: WIDE,
    }).tracker).toEqual([])
  })
})

describe("computeOutageBands — app bands", () => {
  it("draws a recorded gap", () => {
    expect(fmt(bands({ appGaps: [span(0, 30)] }).app)).toBe("0-30")
  })

  it("draws nothing when no gap was recorded — UNKNOWN, not healthy", () => {
    expect(bands().app).toEqual([])
  })

  it("drops a gap under five minutes", () => {
    expect(bands({ appGaps: [{ start: m(0), end: m(5) - 1 }] }).app).toEqual([])
  })

  it("keeps a gap of exactly five minutes", () => {
    expect(fmt(bands({ appGaps: [span(0, 5)] }).app)).toBe("0-5")
  })

  it("draws nothing at all when the ledger has never been written", () => {
    expect(bands({ appGaps: [span(0, 30)], appCoverage: null }).app).toEqual([])
  })

  it("clamps to firstSeenAt — history before instrumentation is never banded", () => {
    const result = bands({ appGaps: [span(-100, 30)], appCoverage: span(0, 600) })
    expect(fmt(result.app)).toBe("0-30")
  })

  it("clamps to lastSeenAt — the open present is never banded", () => {
    const result = bands({ appGaps: [span(0, 500)], appCoverage: span(-600, 60) })
    expect(fmt(result.app)).toBe("0-60")
  })

  it("does NOT require any download client to exist", () => {
    // A clientless install still has tracker charts, and they still deserve an
    // explanation for their flat regions.
    const result = bands({ appGaps: [span(0, 30)], clients: [], qbtCoverage: null })
    expect(fmt(result.app)).toBe("0-30")
    expect(result.allDown).toEqual([])
  })
})

describe("computeOutageBands — the three-state rule", () => {
  const downClient = (id: number, startMin: number, count: number) => ({
    clientId: id,
    buckets: buckets(
      startMin,
      Array.from({ length: count }, () => [0, 12] as [number, number])
    ),
  })

  it("draws a qBT band from positive evidence with no app gap in play", () => {
    expect(fmt(bands({ clients: [downClient(1, 0, 4)] }).allDown)).toBe("0-20")
  })

  it("an app gap SWALLOWS a qBT outage entirely — nothing observed it", () => {
    const result = bands({
      clients: [downClient(1, 10, 2)], // qBT down 10-20
      appGaps: [span(0, 60)],
    })
    expect(result.allDown).toEqual([])
    expect(result.perClient[0].intervals).toEqual([])
    expect(fmt(result.app)).toBe("0-60")
  })

  it("a PARTIAL overlap is trimmed to the observed portion only", () => {
    const result = bands({
      clients: [downClient(1, 0, 8)], // qBT down 0-40
      appGaps: [span(0, 20)],
    })
    expect(fmt(result.allDown)).toBe("20-40")
    expect(fmt(result.app)).toBe("0-20")
  })

  it("a qBT remnant left under five minutes by the subtraction is dropped", () => {
    const result = bands({
      clients: [downClient(1, 0, 5)], // qBT down 0-25
      appGaps: [span(0, 21)], // leaves only 21-25, four minutes
    })
    expect(result.allDown).toEqual([])
  })

  it("app and qBT bands never overlap after subtraction", () => {
    const result = bands({
      clients: [downClient(1, 0, 12)], // 0-60
      appGaps: [span(20, 30)],
    })
    for (const a of result.app) {
      for (const q of result.allDown) {
        expect(Math.min(a.end, q.end) > Math.max(a.start, q.start)).toBe(false)
      }
    }
  })
})

describe("computeOutageBands — fleet semantics", () => {
  const down = (id: number, startMin: number, count: number) => ({
    clientId: id,
    buckets: buckets(
      startMin,
      Array.from({ length: count }, () => [0, 12] as [number, number])
    ),
  })
  const up = (id: number, startMin: number, count: number) => ({
    clientId: id,
    buckets: buckets(
      startMin,
      Array.from({ length: count }, () => [12, 0] as [number, number])
    ),
  })

  it("one of two clients down draws NOTHING — half the data was still collected", () => {
    const result = bands({ clients: [down(1, 0, 4), up(2, 0, 4)] })
    expect(result.allDown).toEqual([])
    expect(fmt(result.perClient[0].intervals)).toBe("0-20")
    expect(result.perClient[1].intervals).toEqual([])
  })

  it("both clients down draws their common window only", () => {
    const result = bands({ clients: [down(1, 0, 8), down(2, 10, 8)] })
    expect(fmt(result.allDown)).toBe("10-40")
  })

  it("a client with NO buckets forces the intersection empty", () => {
    const result = bands({ clients: [down(1, 0, 8), { clientId: 2, buckets: [] }] })
    expect(result.allDown).toEqual([])
  })

  it("zero enabled clients draws nothing and reports no qBT coverage", () => {
    const result = bands({ clients: [], qbtCoverage: null })
    expect(result.allDown).toEqual([])
    expect(result.coverage.qbt).toBeNull()
  })
})

describe("computeOutageBands — clamping and the window", () => {
  const downAll = {
    clientId: 1,
    buckets: buckets(
      -20,
      Array.from({ length: 24 }, () => [0, 12] as [number, number])
    ),
  }

  it("never bands past the last flushed bucket", () => {
    // Buckets run to +100, but only up to +60 has been flushed.
    const result = bands({
      clients: [downAll],
      qbtCoverage: span(-600, 60),
    })
    const last = result.allDown[result.allDown.length - 1]
    expect(last.end).toBe(m(60))
  })

  it("crops to the visible window LAST, so a long outage still shows its edge", () => {
    // A ten-hour app gap of which only the final two minutes are on screen.
    const result = computeOutageBands({
      window: span(0, 120),
      appGaps: [span(-600, 2)],
      clients: [],
      trackerOutages: [],
      appCoverage: span(-1000, 600),
      qbtCoverage: null,
    })
    expect(fmt(result.app)).toBe("0-2")
  })

  it("does not resurrect a too-short outage by measuring it after cropping", () => {
    const result = computeOutageBands({
      window: span(0, 120),
      appGaps: [{ start: m(-4), end: m(-4) + MIN_BAND_MS - 1 }],
      clients: [],
      trackerOutages: [],
      appCoverage: span(-1000, 600),
      qbtCoverage: null,
    })
    expect(result.app).toEqual([])
  })

  it("reports coverage clipped to the window", () => {
    const result = computeOutageBands({
      window: span(0, 120),
      appGaps: [],
      clients: [],
      trackerOutages: [],
      appCoverage: span(-600, 60),
      qbtCoverage: null,
    })
    expect(fmt(result.coverage.app ? [result.coverage.app] : [])).toBe("0-60")
  })

  it("reports null coverage when the window lies entirely outside it", () => {
    const result = computeOutageBands({
      window: span(200, 300),
      appGaps: [],
      clients: [],
      trackerOutages: [],
      appCoverage: span(-600, 60),
      qbtCoverage: null,
    })
    expect(result.coverage.app).toBeNull()
  })

  it("returns nothing for an inverted window rather than throwing", () => {
    const result = computeOutageBands({
      window: span(100, 0),
      appGaps: [span(0, 60)],
      clients: [],
      trackerOutages: [],
      appCoverage: WIDE,
      qbtCoverage: WIDE,
    })
    expect(result.app).toEqual([])
    expect(result.coverage.app).toBeNull()
  })
})
