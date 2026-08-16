// src/components/tracker-detail/__tests__/PollLog.test.tsx
//
// Regression coverage: unlike `TrackerLatestStats`, the `Snapshot` wire type
// has no `ratioIsInfinite` flag, so an infinite ratio (uploaded > 0,
// downloaded === 0) arrives here as a bare `ratio: null` — indistinguishable
// from a genuinely unmeasured poll. PollLog re-derives it from the byte
// totals using the serializer's own predicate (tracker-serializer.ts:60).

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { PollLog } from "@/components/tracker-detail/PollLog"
import type { Snapshot } from "@/types/api"

const baseSnapshot: Snapshot = {
  polledAt: "2026-08-14T12:00:00.000Z",
  ratio: null,
  ratioIsInfinite: false,
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
  seedingCount: 1,
  leechingCount: 0,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
  isManual: false,
}

async function openLog() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /Last polled/ }))
}

describe("PollLog ratio column (infinite ratio)", () => {
  it("renders '∞x' for a zero-download poll instead of '—'", async () => {
    const infinite: Snapshot = {
      ...baseSnapshot,
      polledAt: "2026-08-14T12:00:00.000Z",
      uploadedBytes: "1000",
      downloadedBytes: "0",
      ratio: null,
      ratioIsInfinite: false,
    }

    render(
      <PollLog
        snapshots={[infinite]}
        lastPolledAt={infinite.polledAt}
        lastError={null}
        lastErrorAt={null}
      />
    )
    await openLog()

    expect(screen.getByText("∞x")).toBeInTheDocument()
  })

  it("keeps rendering '—' for a poll with a genuinely missing ratio", async () => {
    const unmeasured: Snapshot = {
      ...baseSnapshot,
      polledAt: "2026-08-14T12:00:00.000Z",
      uploadedBytes: "500",
      downloadedBytes: "500",
      ratio: null,
      ratioIsInfinite: false,
    }

    render(
      <PollLog
        snapshots={[unmeasured]}
        lastPolledAt={unmeasured.polledAt}
        lastError={null}
        lastErrorAt={null}
      />
    )
    await openLog()

    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("∞x")).not.toBeInTheDocument()
  })

  it("still renders a finite ratio normally", async () => {
    const finite: Snapshot = {
      ...baseSnapshot,
      polledAt: "2026-08-14T12:00:00.000Z",
      uploadedBytes: "2500",
      downloadedBytes: "1000",
      ratio: 2.5,
      ratioIsInfinite: false,
    }

    render(
      <PollLog
        snapshots={[finite]}
        lastPolledAt={finite.polledAt}
        lastError={null}
        lastErrorAt={null}
      />
    )
    await openLog()

    expect(screen.getByText("2.50x")).toBeInTheDocument()
  })
})
