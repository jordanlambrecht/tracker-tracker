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
// 2. Neither pause banner appears once the tracker is archived, and nothing replaces them.
//    The detail header's "Archived" badge and the defunct banner above already say it.
// 3. An archived tracker's lastError survives the suppression. Before this change the
//    last-error card was gated on `!pause.isPaused`, so dropping the pause banner from an
//    archived + auto-paused + lastError tracker would have left the page with no copy of the
//    error at all. That regression is the reason the gate now reads off the pause banners.
// 4. A row the tracker list doesn't carry can't be polled or resumed, whatever paused it, so
//    one card says why and offers Archive and Delete in place of Resume.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrackerStatusBanner } from "@/components/tracker-detail/TrackerStatusBanner"
import { trackerQueryOptions } from "@/lib/query-options"
import { UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

/** Only the fields the banner reads; the rest of TrackerSummary is irrelevant here. */
function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 42,
    name: "Orpheus",
    baseUrl: "https://orpheus.network",
    linked: true,
    isActive: true,
    lastPolledAt: "2026-08-14T12:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    pausedAt: null,
    userPausedAt: null,
    ...overrides,
  } as unknown as TrackerSummary
}

/** A second cached row, so the tests can prove only this tracker is rewritten. */
const OTHER = makeTracker({ id: 7, name: "Aither" })

function renderBanner(tracker: TrackerSummary, pollError: string | null = null) {
  const onResume = vi.fn()
  const onDismissPollError = vi.fn()
  const onArchived = vi.fn()
  const onDeleted = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(trackerQueryOptions.queryKey, [tracker, OTHER])
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TrackerStatusBanner
        tracker={tracker}
        pollError={pollError}
        onDismissPollError={onDismissPollError}
        onResume={onResume}
        onArchived={onArchived}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>
  )
  return { ...view, onResume, onDismissPollError, onArchived, onDeleted, queryClient }
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

describe("TrackerStatusBanner on a row the tracker list doesn't carry", () => {
  const UNLINKED = { linked: false, baseUrl: "https://www.old-host.example" }
  const fetchMock = vi.fn()

  function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => body }
  }

  function unlinkedHeading() {
    return screen.queryByText("Not in the tracker list")
  }

  function cachedTrackers(queryClient: QueryClient) {
    return queryClient.getQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey)
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it.each<[string, Partial<TrackerSummary>]>([
    [
      "paused by the poll",
      {
        ...AUTO_PAUSED,
        lastError:
          "Not in the tracker list, so it isn't polled. It was set up for old-host.example",
      },
    ],
    ["paused by a restore", { ...AUTO_PAUSED, lastError: UNLINKED_RESTORE_ERROR }],
    ["paused for failures before it was unlinked", { ...AUTO_PAUSED, lastError: "HTTP 301" }],
    // The user's own pause isn't why it sits idle, so it doesn't hide the reason
    ["paused by the user", USER_PAUSED],
    ["not paused yet", {}],
  ])("explains a row %s and offers Archive and Delete, not Resume", (_, state) => {
    renderBanner(makeTracker({ ...UNLINKED, ...state }))

    expect(unlinkedHeading()).toBeInTheDocument()
    expect(
      screen.getByText(
        "This tracker isn't in the tracker list, so it isn't polled. It was set up for old-host.example. Archive it to keep its history, or delete it."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(resumeButton()).not.toBeInTheDocument()
    expect(pausedHeading()).not.toBeInTheDocument()
    expect(screen.queryByText(/Last error/i)).not.toBeInTheDocument()
  })

  it("drops the host sentence when the stored address won't parse", () => {
    renderBanner(makeTracker({ ...UNLINKED, ...AUTO_PAUSED, baseUrl: "not a url" }))

    expect(
      screen.getByText(
        "This tracker isn't in the tracker list, so it isn't polled. Archive it to keep its history, or delete it."
      )
    ).toBeInTheDocument()
  })

  it("keeps the archived rule: no card, only the last error", () => {
    renderBanner(makeTracker({ ...UNLINKED, ...AUTO_PAUSED, ...LAST_ERROR, isActive: false }))

    expect(unlinkedHeading()).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()
    expect(screen.getByText("Last Error")).toBeInTheDocument()
  })

  it("archives through the shared cache and hands the PATCH response back", async () => {
    const user = userEvent.setup()
    const row = makeTracker({ ...UNLINKED, ...AUTO_PAUSED })
    const archived = { ...row, isActive: false }
    fetchMock.mockResolvedValue(jsonResponse(archived))
    const { queryClient, onArchived } = renderBanner(row)

    await user.click(screen.getByRole("button", { name: "Archive" }))

    await waitFor(() => expect(onArchived).toHaveBeenCalledWith(archived))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/trackers/42")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toEqual({ isActive: false })
    expect(cachedTrackers(queryClient)).toEqual([archived, OTHER])
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(true)
  })

  it("deletes after confirmation and drops the row from the shared cache", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(jsonResponse({ success: true }))
    const { queryClient, onDeleted } = renderBanner(makeTracker({ ...UNLINKED, ...AUTO_PAUSED }))

    await user.click(screen.getByRole("button", { name: "Delete" }))
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith("/api/trackers/42", { method: "DELETE" })
    expect(cachedTrackers(queryClient)).toEqual([OTHER])
  })

  it("reports a failed delete with the server's reason and keeps the row", async () => {
    const user = userEvent.setup()
    // What authenticate() answers for a session minted under an old password
    const stale = "Your session is out of date. Sign in again."
    fetchMock.mockResolvedValue(jsonResponse({ error: stale }, { ok: false, status: 401 }))
    const row = makeTracker({ ...UNLINKED, ...AUTO_PAUSED })
    const { queryClient, onDeleted } = renderBanner(row)

    await user.click(screen.getByRole("button", { name: "Delete" }))
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }))

    expect(await screen.findByText(stale)).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(cachedTrackers(queryClient)).toEqual([row, OTHER])
  })
})
