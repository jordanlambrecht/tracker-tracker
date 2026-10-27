// src/components/dashboard/__tests__/ProwlarrFailures.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProwlarrFailures } from "@/components/dashboard/ProwlarrFailures"
import type { TrackerProwlarrIndexer, TrackerSummary } from "@/types/api"

function indexer(overrides: Partial<TrackerProwlarrIndexer> = {}): TrackerProwlarrIndexer {
  return {
    instanceId: 3,
    instanceName: "Home",
    instanceUrl: "http://prowlarr.test:9696",
    instancePublicUrl: null,
    instanceError: null,
    stale: false,
    indexerId: 12,
    name: "Example Indexer",
    enabled: true,
    disabledTill: null,
    mostRecentFailure: null,
    initialFailure: null,
    checkedAt: "2026-08-14T12:00:00.000Z",
    stats24h: null,
    stats7d: null,
    statsStaleSince: null,
    ...overrides,
  }
}

const FAILING = { disabledTill: "2026-08-14T13:00:00.000Z" }

function tracker(id: number, name: string, indexers: TrackerProwlarrIndexer[], isActive = true) {
  return {
    id,
    name,
    isActive,
    prowlarr: indexers.length > 0 ? { matchedBy: "auto", indexers } : null,
  } as unknown as TrackerSummary
}

describe("ProwlarrFailures", () => {
  it("lists each failing indexer with a link to its tracker", () => {
    render(
      <ProwlarrFailures
        trackers={[
          tracker(1, "Alpha", [indexer({ ...FAILING, name: "Alpha Indexer" })]),
          tracker(2, "Beta", [indexer({ indexerId: 13, name: "Beta Indexer" })]),
        ]}
      />
    )

    expect(screen.getByText("Failing in Prowlarr")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Alpha Indexer/ })).toHaveAttribute(
      "href",
      "/trackers/1"
    )
    expect(screen.queryByText(/Beta Indexer/)).not.toBeInTheDocument()
  })

  it("shows an instance error once, however many trackers share the instance", () => {
    const error = { instanceError: "Prowlarr unreachable: Connection refused" }
    render(
      <ProwlarrFailures
        trackers={[
          tracker(1, "Alpha", [indexer(error)]),
          tracker(2, "Beta", [indexer({ ...error, indexerId: 13 })]),
        ]}
      />
    )

    expect(screen.getAllByText("Prowlarr unreachable: Connection refused")).toHaveLength(1)
    expect(screen.queryByText("Failing in Prowlarr")).not.toBeInTheDocument()
  })

  it("renders nothing when all is well or only archived trackers fail", () => {
    const { container } = render(
      <ProwlarrFailures
        trackers={[
          tracker(1, "Alpha", [indexer()]),
          tracker(2, "Beta", [indexer({ ...FAILING, indexerId: 13 })], false),
        ]}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
