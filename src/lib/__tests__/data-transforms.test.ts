// src/lib/__tests__/data-transforms.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  compareBigIntDesc,
  computeDelta,
  computePctChange,
  isUnixTimestampOnDate,
  normalizeUrl,
  ratioTrend24h,
  sanitizeHost,
  stripTrailingSlash,
} from "@/lib/data-transforms"
import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"

// ---------------------------------------------------------------------------
// sanitizeHost
// ---------------------------------------------------------------------------

describe("sanitizeHost", () => {
  it("strips https:// prefix", () => {
    expect(sanitizeHost("https://example.com")).toBe("example.com")
  })

  it("strips http:// prefix", () => {
    expect(sanitizeHost("http://example.com")).toBe("example.com")
  })

  it("trims whitespace then strips protocol", () => {
    expect(sanitizeHost("  https://example.com  ")).toBe("example.com")
  })

  it("passes through a host with no protocol unchanged", () => {
    expect(sanitizeHost("example.com")).toBe("example.com")
  })

  it("does not strip non-http protocols", () => {
    expect(sanitizeHost("ftp://example.com")).toBe("ftp://example.com")
  })
})

// ---------------------------------------------------------------------------
// normalizeUrl
// ---------------------------------------------------------------------------

describe("normalizeUrl", () => {
  it("lowercases the URL", () => {
    expect(normalizeUrl("HTTPS://FOO.COM")).toBe("https://foo.com")
  })

  it("strips a single trailing slash", () => {
    expect(normalizeUrl("https://Example.com/")).toBe("https://example.com")
  })

  it("strips multiple trailing slashes", () => {
    expect(normalizeUrl("https://example.com///")).toBe("https://example.com")
  })

  it("returns the URL unchanged when already normalized", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com")
  })
})

describe("stripTrailingSlash", () => {
  it("strips one slash and several", () => {
    expect(stripTrailingSlash("https://example.com/")).toBe("https://example.com")
    expect(stripTrailingSlash("https://example.com///")).toBe("https://example.com")
  })

  it("leaves a URL that already ends cleanly", () => {
    expect(stripTrailingSlash("https://example.com")).toBe("https://example.com")
    expect(stripTrailingSlash("https://example.com/tracker")).toBe("https://example.com/tracker")
  })

  it("keeps case, unlike normalizeUrl, because base URLs are joined with case-sensitive paths", () => {
    expect(stripTrailingSlash("https://Example.com/Tracker/")).toBe("https://Example.com/Tracker")
  })
})

// ---------------------------------------------------------------------------
// compareBigIntDesc
// ---------------------------------------------------------------------------

describe("compareBigIntDesc", () => {
  it("returns 1 when b > a (a sorts after b in descending order)", () => {
    expect(compareBigIntDesc(1n, 2n)).toBe(1)
  })

  it("returns -1 when b < a (a sorts before b in descending order)", () => {
    expect(compareBigIntDesc(2n, 1n)).toBe(-1)
  })

  it("returns 0 when a and b are equal", () => {
    expect(compareBigIntDesc(1n, 1n)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computePctChange
// ---------------------------------------------------------------------------

describe("computePctChange", () => {
  it("returns 100 for a value that doubled", () => {
    expect(computePctChange("200", "100")).toBe(100)
  })

  it("returns -50 for a value that halved", () => {
    expect(computePctChange("100", "200")).toBe(-50)
  })

  it("returns null when yesterday is null", () => {
    expect(computePctChange("100", null)).toBeNull()
  })

  it("returns null when yesterday is zero (division by zero guard)", () => {
    expect(computePctChange("100", "0")).toBeNull()
  })

  it("returns null when today is not a valid bigint string", () => {
    expect(computePctChange("abc", "100")).toBeNull()
  })

  it("returns null when yesterday is not a valid bigint string", () => {
    expect(computePctChange("100", "xyz")).toBeNull()
  })

  // Buffer deltas are signed, and a negative baseline inverts the sign. -100 to
  // -50 would read "-50%" and -100 to -200 "+100%", so null is returned instead.
  it("returns null rather than inverting through a negative baseline", () => {
    expect(computePctChange("-50", "-100")).toBeNull()
    expect(computePctChange("-200", "-100")).toBeNull()
    expect(computePctChange("100", "-100")).toBeNull()
  })

  it("returns null when today is negative", () => {
    expect(computePctChange("-50", "100")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isUnixTimestampOnDate
// ---------------------------------------------------------------------------

describe("isUnixTimestampOnDate", () => {
  it("returns false for 0 (falsy zero guard)", () => {
    expect(isUnixTimestampOnDate(0, "1970-01-01")).toBe(false)
  })

  it("returns false for negative timestamps", () => {
    expect(isUnixTimestampOnDate(-1, "anything")).toBe(false)
  })

  it("returns true when the timestamp falls on the expected date", () => {
    // Build the expected date string via the same localDateStr used by the function
    // so the test is immune to timezone differences on the CI runner.
    const ts = Math.floor(new Date("2026-03-15T12:00:00").getTime() / 1000)
    const expected = localDateStr(new Date(ts * 1000))
    expect(isUnixTimestampOnDate(ts, expected)).toBe(true)
  })

  it("returns false when the date string does not match", () => {
    const ts = Math.floor(new Date("2026-03-15T12:00:00").getTime() / 1000)
    expect(isUnixTimestampOnDate(ts, "1999-01-01")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ratioTrend24h and computeDelta's window
// ---------------------------------------------------------------------------

describe("ratioTrend24h", () => {
  const NOW = Date.UTC(2026, 9, 24, 12)

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function snap(hoursAgo: number, ratio: number | null, uploaded = "1000"): Snapshot {
    return {
      polledAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
      uploadedBytes: uploaded,
      downloadedBytes: "1000",
      ratio,
      ratioIsInfinite: false,
    } as Snapshot
  }

  const infinite = (hoursAgo: number): Snapshot => ({
    ...snap(hoursAgo, null),
    ratioIsInfinite: true,
  })

  it("compares the latest reading with the earliest inside the last 24 hours", () => {
    // 3.0 until a day ago, 3.5 for 14 hours, then 3.2 for the last 10
    const series = [
      snap(48, 3.0),
      snap(30, 3.0),
      snap(24, 3.5),
      snap(11, 3.5),
      snap(10, 3.2),
      snap(0, 3.2),
    ]
    expect(ratioTrend24h(series)).toBe("down")
    expect(ratioTrend24h([snap(20, 4.4), snap(0, 4.48)])).toBe("up")
    expect(ratioTrend24h([snap(20, 4.48), snap(2, 4.0), snap(0, 4.48)])).toBe("flat")
  })

  it("ignores an old tracker's daily rows from before the window", () => {
    // What the all-time query returns past 90 days: the last poll of each day
    const daily = [snap(72, 3.0), snap(47, 3.0), snap(23, 3.5), snap(0, 3.2)]
    expect(ratioTrend24h(daily)).toBe("down")
    expect(ratioTrend24h(daily.slice(0, 3).concat(snap(0, 3.5)))).toBe("flat")
    expect(ratioTrend24h([snap(72, 3.0), snap(47, 3.0), snap(0, 3.2)])).toBeUndefined()
  })

  it("shows a young tracker's movement since its first poll", () => {
    expect(ratioTrend24h([snap(23, 1), snap(0, 2)])).toBe("up")
  })

  it("has no trend without two readings in the window or without a ratio", () => {
    expect(ratioTrend24h([])).toBeUndefined()
    expect(ratioTrend24h([snap(0, 2)])).toBeUndefined()
    expect(ratioTrend24h([snap(50, 1), snap(25, 2)])).toBeUndefined()
    expect(ratioTrend24h([snap(20, null), snap(0, 2)])).toBeUndefined()
  })

  it("reads snapshots in any order", () => {
    expect(ratioTrend24h([snap(0, 2), snap(20, 1)])).toBe("up")
  })

  it("ranks an infinite ratio above any finite one", () => {
    expect(ratioTrend24h([snap(20, 3), infinite(0)])).toBe("up")
    expect(ratioTrend24h([infinite(20), snap(0, 3)])).toBe("down")
    expect(ratioTrend24h([infinite(20), infinite(0)])).toBe("flat")
  })

  it("matches the window computeDelta measures", () => {
    const daily = [snap(47, 3.0, "1000"), snap(23, 3.5, "4000"), snap(0, 3.2, "5000")]
    expect(computeDelta(daily)).toEqual({ uploaded: "1000", downloaded: "0" })
    expect(computeDelta([snap(47, 3.0), snap(0, 3.2)])).toBeNull()
  })
})
