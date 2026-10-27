// src/lib/__tests__/prowlarr-status.test.ts

import { describe, expect, it } from "vitest"
import {
  describeIndexerStatus,
  getIndexerStatus,
  getProwlarrFailures,
  prowlarrLinkUrl,
  statsTotals,
} from "@/lib/prowlarr/status"
import { getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerProwlarrIndexer, TrackerSummary } from "@/types/api"

const CHECKED_AT = "2026-08-14T12:00:00.000Z"

function indexer(overrides: Partial<TrackerProwlarrIndexer> = {}): TrackerProwlarrIndexer {
  return {
    instanceId: 3,
    instanceName: "Home",
    instanceUrl: "http://prowlarr.test:9696/",
    instancePublicUrl: null,
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

describe("prowlarrLinkUrl", () => {
  it("links to the instance URL, with its URL base, without a public URL", () => {
    expect(
      prowlarrLinkUrl({ instanceUrl: "http://host.test/prowlarr/", instancePublicUrl: null })
    ).toBe("http://host.test/prowlarr")
  })

  it("links to the public URL when one is set", () => {
    expect(
      prowlarrLinkUrl({
        instanceUrl: "http://prowlarr:9696",
        instancePublicUrl: "https://prowlarr.example.com/",
      })
    ).toBe("https://prowlarr.example.com")
  })
})

// A backed-off indexer can mean stale credentials in Prowlarr or a problem with
// its own proxy, so it is shown beside the tracker's health and never changes it.
describe("tracker health", () => {
  it("is unchanged by a failing indexer", () => {
    const base = {
      isActive: true,
      lastError: null,
      pausedAt: null,
      userPausedAt: null,
      latestStats: null,
    } as unknown as TrackerSummary
    const failing = {
      ...base,
      prowlarr: { matchedBy: "auto", indexers: [indexer(backedOff("2026-08-14T10:00:00.000Z"))] },
    } as TrackerSummary
    expect(getTrackerHealth(failing)).toBe(getTrackerHealth(base))
  })
})
