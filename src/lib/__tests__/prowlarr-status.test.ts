// src/lib/__tests__/prowlarr-status.test.ts

import { describe, expect, it } from "vitest"
import {
  describeIndexerStatus,
  getIndexerStatus,
  getProwlarrFailures,
  prowlarrIndexersUrl,
  statsTotals,
} from "@/lib/prowlarr/status"
import {
  getHealthDescription,
  getHealthDot,
  getHealthLabel,
  getTrackerHealth,
} from "@/lib/tracker-status"
import type { TrackerProwlarrIndexer, TrackerSummary } from "@/types/api"

const CHECKED_AT = "2026-08-14T12:00:00.000Z"

function indexer(overrides: Partial<TrackerProwlarrIndexer> = {}): TrackerProwlarrIndexer {
  return {
    instanceId: 3,
    instanceName: "Home",
    instanceUrl: "http://prowlarr.test:9696/",
    affectsHealth: false,
    instanceError: null,
    stale: false,
    indexerId: 12,
    name: "Example Indexer",
    enabled: true,
    disabledTill: null,
    mostRecentFailure: null,
    initialFailure: null,
    checkedAt: CHECKED_AT,
    stats24h: null,
    stats7d: null,
    statsStaleSince: null,
    ...overrides,
  }
}

const backedOff = (initialFailure: string) => ({
  disabledTill: "2026-08-14T13:00:00.000Z",
  initialFailure,
})

describe("getIndexerStatus", () => {
  it("reads a backoff that outlasts the reading as failing", () => {
    expect(getIndexerStatus(indexer(backedOff("2026-08-14T10:00:00.000Z")))).toBe("failing")
  })

  it("reads a backoff that ended before the reading as ok", () => {
    expect(getIndexerStatus(indexer({ disabledTill: "2026-08-14T11:00:00.000Z" }))).toBe("ok")
  })

  it("puts a Prowlarr error, a disabled indexer and a stale reading before the backoff", () => {
    const failing = backedOff("2026-08-14T10:00:00.000Z")
    expect(getIndexerStatus(indexer({ ...failing, instanceError: "API key rejected" }))).toBe(
      "prowlarr-error"
    )
    expect(getIndexerStatus(indexer({ ...failing, enabled: false }))).toBe("disabled")
    expect(getIndexerStatus(indexer({ ...failing, stale: true }))).toBe("stale")
  })
})

describe("describeIndexerStatus", () => {
  it("shows a Prowlarr error as it was worded, not as unreachable", () => {
    expect(describeIndexerStatus(indexer({ instanceError: "API key rejected by Prowlarr" }))).toBe(
      "API key rejected by Prowlarr"
    )
  })

  it("says since when an indexer has been failing", () => {
    expect(describeIndexerStatus(indexer(backedOff("2026-08-14T10:00:00.000Z")))).toMatch(
      /^Failing in Prowlarr since .+, retrying at .+/
    )
  })
})

describe("getProwlarrFailures", () => {
  it("lists only failing indexers, longest-failing first", () => {
    const newer = indexer({ indexerId: 1, ...backedOff("2026-08-14T11:00:00.000Z") })
    const older = indexer({ indexerId: 2, ...backedOff("2026-08-13T11:00:00.000Z") })
    const tracker = {
      prowlarr: { matchedBy: "auto" as const, indexers: [newer, indexer(), older] },
    }
    expect(getProwlarrFailures(tracker).map((i) => i.indexerId)).toEqual([2, 1])
  })
})

describe("statsTotals", () => {
  it("counts grabs apart from queries and in the share that failed", () => {
    expect(
      statsTotals({
        averageResponseTime: 300,
        queries: 20,
        grabs: 3,
        rssQueries: 76,
        authQueries: 1,
        failedQueries: 5,
        failedGrabs: 0,
        failedRssQueries: 20,
        failedAuthQueries: 0,
      })
    ).toEqual({ queries: 97, failed: 25, failureRate: 0.25 })
  })

  it("has no failure rate without requests", () => {
    const zero = {
      averageResponseTime: 0,
      queries: 0,
      grabs: 0,
      rssQueries: 0,
      authQueries: 0,
      failedQueries: 0,
      failedGrabs: 0,
      failedRssQueries: 0,
      failedAuthQueries: 0,
    }
    expect(statsTotals(zero).failureRate).toBeNull()
  })
})

describe("prowlarrIndexersUrl", () => {
  // The indexer list is Prowlarr's home page. It has no /indexers route.
  it.each([
    ["http://prowlarr.test:9696", "http://prowlarr.test:9696/"],
    ["http://prowlarr.test:9696/", "http://prowlarr.test:9696/"],
    ["http://host.test/prowlarr", "http://host.test/prowlarr/"],
    ["http://host.test/prowlarr//", "http://host.test/prowlarr/"],
  ])("links %s to its indexer list at %s", (instanceUrl, url) => {
    expect(prowlarrIndexersUrl({ instanceUrl })).toBe(url)
  })
})

// A backed-off indexer can mean stale credentials in Prowlarr or a problem with
// its own proxy, so it changes tracker health only where the instance opts in.
describe("tracker health", () => {
  const base = {
    isActive: true,
    linked: true,
    lastError: null,
    pausedAt: null,
    userPausedAt: null,
    registrySlug: null,
    latestStats: { ratio: 5, ratioIsInfinite: false, seedingCount: 3, requiredRatio: 1 },
  } as unknown as TrackerSummary
  const withIndexer = (overrides: Partial<TrackerProwlarrIndexer>, tracker = base) =>
    ({
      ...tracker,
      prowlarr: {
        matchedBy: "auto",
        indexers: [indexer({ ...backedOff("2026-08-14T10:00:00.000Z"), ...overrides })],
      },
    }) as TrackerSummary

  it("is unchanged by a failing indexer of an instance that has not opted in", () => {
    expect(getTrackerHealth(withIndexer({ affectsHealth: false }))).toBe("healthy")
  })

  it("marks a healthy tracker with its own state and label, not the ratio warning", () => {
    const tracker = withIndexer({ affectsHealth: true })
    const health = getTrackerHealth(tracker)
    expect(health).toBe("indexer-failing")
    expect(getHealthDot(health)).toEqual({ tone: "warn", glow: true, label: "Indexer Failing" })
    expect(getHealthLabel(health)).toBe("Indexer Failing")
    expect(getHealthDescription(health, tracker)).toMatch(/^Example Indexer: Failing in Prowlarr/)
  })

  it("never hides a worse status", () => {
    const critical = {
      ...base,
      latestStats: { ...base.latestStats, ratio: 0.5 },
    } as unknown as TrackerSummary
    expect(getTrackerHealth(withIndexer({ affectsHealth: true }, critical))).toBe("critical")
  })

  it("ignores an opted-in instance whose indexer is not failing", () => {
    expect(getTrackerHealth(withIndexer({ affectsHealth: true, disabledTill: null }))).toBe(
      "healthy"
    )
  })
})
