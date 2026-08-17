// src/components/tracker-detail/__tests__/TrackerStatusBanner.test.tsx
//
// The banner speaks for the poll scheduler, so every state it announces has to be one the
// scheduler is actually in. An archived tracker (isActive false) is excluded from the poll
// cycle entirely, which makes "Polling Paused" a claim about a rotation the tracker left and
// "Resume Polling" a button whose route clears pausedAt without restoring isActive. Three
// things are pinned:
//
// 1. The pause banners still appear for an ACTIVE tracker, paused either way. The fix is a
//    suppression, and a suppression that over-reaches silently removes a working affordance.
// 2. Neither pause banner appears once the tracker is archived, and nothing replaces them —
//    the detail header's "Archived" badge and the defunct banner above already say it.
// 3. An archived tracker's lastError survives the suppression. Before this change the
//    last-error card was gated on `!pause.isPaused`, so dropping the pause banner from an
//    archived + auto-paused + lastError tracker would have left the page with no copy of the
//    error at all. That regression is the reason the gate now reads off the pause banners.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrackerStatusBanner } from "@/components/tracker-detail/TrackerStatusBanner"
import type { TrackerSummary } from "@/types/api"

/** Only the fields the banner reads; the rest of TrackerSummary is irrelevant here. */
function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 42,
    name: "Orpheus",
    isActive: true,
    lastPolledAt: "2026-08-14T12:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    pausedAt: null,
    userPausedAt: null,
    ...overrides,
  } as unknown as TrackerSummary
}

function renderBanner(tracker: TrackerSummary, pollError: string | null = null) {
  const onResume = vi.fn()
  const onDismissPollError = vi.fn()
  const view = render(
    <TrackerStatusBanner
      tracker={tracker}
      pollError={pollError}
      onDismissPollError={onDismissPollError}
      onResume={onResume}
    />
  )
  return { ...view, onResume, onDismissPollError }
}

function resumeButton() {
  return screen.queryByRole("button", { name: "Resume Polling" })
}

function pausedHeading() {
  return screen.queryByText("Polling Paused")
}

const AUTO_PAUSED = { pausedAt: "2026-08-10T09:00:00.000Z" }
const USER_PAUSED = { userPausedAt: "2026-08-10T09:00:00.000Z" }
const LAST_ERROR = { lastError: "401 Unauthorized" }

describe("TrackerStatusBanner on an active tracker", () => {
  it("offers Resume Polling for a tracker auto-paused after repeated failures", () => {
    renderBanner(makeTracker(AUTO_PAUSED))

    expect(pausedHeading()).toBeInTheDocument()
    expect(resumeButton()).toBeInTheDocument()
  })

  it("announces a user-paused tracker (which has never carried a resume button)", () => {
    renderBanner(makeTracker(USER_PAUSED))

    expect(pausedHeading()).toBeInTheDocument()
    expect(screen.getByText(/Automated polling is paused by the user/)).toBeInTheDocument()
    expect(resumeButton()).not.toBeInTheDocument()
  })

  it("shows the last error on its own once the tracker is neither paused nor mid-action", () => {
    renderBanner(makeTracker(LAST_ERROR))

    expect(screen.getByText("Last Error")).toBeInTheDocument()
    expect(screen.getByText("401 Unauthorized")).toBeInTheDocument()
  })
})

describe("TrackerStatusBanner on an archived tracker", () => {
  it("renders nothing at all for an archived tracker auto-paused before archiving", () => {
    // Nothing, not a quieter archived note: the header badge and the defunct banner
    // above this component already say the tracker is archived and no longer polled.
    const { container } = renderBanner(makeTracker({ isActive: false, ...AUTO_PAUSED }))

    expect(container).toBeEmptyDOMElement()
    expect(resumeButton()).not.toBeInTheDocument()
    expect(pausedHeading()).not.toBeInTheDocument()
  })

  it("renders nothing at all for an archived tracker the user had paused", () => {
    const { container } = renderBanner(makeTracker({ isActive: false, ...USER_PAUSED }))

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/Automated polling is paused by the user/)).not.toBeInTheDocument()
  })

  it("keeps the last error visible instead of losing it with the pause banner", () => {
    // Regression guard for the gate swap: `!pause.isPaused` would have hidden this card
    // too, so suppressing the pause banner would have erased the error from the page.
    renderBanner(makeTracker({ isActive: false, ...AUTO_PAUSED, ...LAST_ERROR }))

    expect(screen.getByText("Last Error")).toBeInTheDocument()
    expect(screen.getByText("401 Unauthorized")).toBeInTheDocument()
    expect(resumeButton()).not.toBeInTheDocument()
    expect(pausedHeading()).not.toBeInTheDocument()
  })

  it("still reports a poll error the user just triggered", () => {
    // Unlike the pause banners this is feedback for an action taken seconds ago, not a
    // claim about the scheduler, so archiving does not make it wrong.
    renderBanner(makeTracker({ isActive: false, ...AUTO_PAUSED }), "Poll failed: 403 Forbidden")

    expect(screen.getByText(/Poll error: Poll failed: 403 Forbidden/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dismiss error" })).toBeInTheDocument()
    expect(resumeButton()).not.toBeInTheDocument()
  })
})
