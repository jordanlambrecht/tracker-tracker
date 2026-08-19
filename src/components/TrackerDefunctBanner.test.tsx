// src/components/TrackerDefunctBanner.test.tsx
//
// The defunct banner is registry-driven UI with one side effect, so three things are pinned:
//
// 1. It renders on `defunct: true` and on nothing else. A banner announcing a shutdown that
//    hasn't happened is worse than no banner at all, so "renders nothing" is asserted for the
//    ordinary tracker and for a tracker with no registry entry at all.
// 2. "Archive Now?" archives through the same contract as TrackerSettingsSheet.handleArchive —
//    PATCH {isActive: false}, then write the returned row through the shared ["trackers"] cache
//    and invalidate it. Skipping that write-through is exactly the staleness bug the sheet was
//    fixed for, so the cache assertions here are a regression guard, not decoration.
// 3. The button is not offered on an already-archived tracker. Archiving twice is a no-op, and
//    a button that does nothing reads as a broken button.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"
import { TrackerDefunctBanner } from "./TrackerDefunctBanner"

const REDDIT_THREAD = "https://www.reddit.com/r/trackers/comments/1tac6ry/fearnopeer_is_shutting_down/"

const LIVE_ENTRY: TrackerRegistryEntry = {
  slug: "aither",
  name: "Aither",
  url: "https://aither.cc",
  description: "A live tracker.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "General",
  contentCategories: ["Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  color: "#01d4ff",
}

const DEFUNCT_ENTRY: TrackerRegistryEntry = {
  ...LIVE_ENTRY,
  slug: "fearnopeer",
  name: "FearNoPeer",
  url: "https://fearnopeer.com",
  defunct: true,
  defunctMessage: "FearNoPeer has shut down.",
  defunctDate: "2026-05-11",
  defunctLink: REDDIT_THREAD,
}

const TRACKER = { id: 42, name: "FearNoPeer", isActive: true }

/** The row the shared cache holds before the archive, as /api/trackers returned it. */
const CACHED_ROW = { id: 42, name: "FearNoPeer", isActive: true } as unknown as TrackerSummary
/** A second row, so the tests can prove only the archived tracker is rewritten. */
const OTHER_ROW = { id: 7, name: "Orpheus", isActive: true } as unknown as TrackerSummary
/** What PATCH returns: the freshly-read row, which is what lets callers skip a follow-up GET. */
const ARCHIVED_ROW = { ...CACHED_ROW, isActive: false }

const fetchMock = vi.fn()

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

let patchResult = jsonResponse(ARCHIVED_ROW)

function renderBanner(
  overrides: Partial<Parameters<typeof TrackerDefunctBanner>[0]> = {}
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(trackerQueryOptions.queryKey, [CACHED_ROW, OTHER_ROW])

  const props = {
    registryEntry: DEFUNCT_ENTRY,
    tracker: TRACKER,
    onArchived: vi.fn(),
    ...overrides,
  }
  render(
    <QueryClientProvider client={queryClient}>
      <TrackerDefunctBanner {...props} />
    </QueryClientProvider>
  )
  return { ...props, queryClient }
}

function cachedTrackers(queryClient: QueryClient) {
  return queryClient.getQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey)
}

function archiveButton() {
  return screen.queryByRole("button", { name: "Archive Now?" })
}

beforeEach(() => {
  fetchMock.mockReset()
  patchResult = jsonResponse(ARCHIVED_ROW)
  fetchMock.mockImplementation(async () => patchResult)
  vi.stubGlobal("fetch", fetchMock)
})

describe("TrackerDefunctBanner visibility", () => {
  // Rendered bare, with no QueryClientProvider, on purpose. Every card in the
  // dashboard grid mounts one of these and almost none are defunct, so the
  // inert case must not drag a QueryClient subscription in with it — otherwise
  // merely displaying the grid would require a provider.
  it("renders nothing for a tracker the registry does not mark defunct", () => {
    const { container } = render(
      <TrackerDefunctBanner registryEntry={LIVE_ENTRY} tracker={TRACKER} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing for a tracker with no registry entry at all", () => {
    const { container } = render(<TrackerDefunctBanner registryEntry={undefined} tracker={TRACKER} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("shows the message, the readable shutdown date, and the announcement link", () => {
    renderBanner()

    expect(screen.getByText(/FearNoPeer has shut down\./)).toBeInTheDocument()
    // Authored as "2026-05-11"; the point of that format is that it renders like this.
    expect(screen.getByText("May 11, 2026")).toBeInTheDocument()

    const link = screen.getByRole("link", { name: /Announcement/ })
    expect(link).toHaveAttribute("href", REDDIT_THREAD)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders the compact card variant with the same facts and action", () => {
    renderBanner({ variant: "compact" })

    expect(screen.getByText(/Defunct · May 11, 2026/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Details/ })).toHaveAttribute("href", REDDIT_THREAD)
    expect(archiveButton()).toBeInTheDocument()
  })
})

describe("TrackerDefunctBanner archive action", () => {
  it("archives through the shared cache path and hands the PATCH response back", async () => {
    const user = userEvent.setup()
    const { queryClient, onArchived } = renderBanner()

    await user.click(screen.getByRole("button", { name: "Archive Now?" }))

    await waitFor(() => expect(onArchived).toHaveBeenCalledWith(ARCHIVED_ROW))

    // Same endpoint and payload as TrackerSettingsSheet.handleArchive. Not a toggle:
    // the button only exists while the tracker is active, so the target state is literal.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/trackers/42")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toEqual({ isActive: false })

    // Write-through: the sidebar's `showArchived || t.isActive` filter and the dashboard
    // grid both read this array directly, and neither is remounted by navigating home.
    expect(cachedTrackers(queryClient)).toEqual([ARCHIVED_ROW, OTHER_ROW])
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(true)
  })

  it("archives from the compact card variant too", async () => {
    const user = userEvent.setup()
    const { queryClient, onArchived } = renderBanner({ variant: "compact" })

    await user.click(screen.getByRole("button", { name: "Archive Now?" }))

    await waitFor(() => expect(onArchived).toHaveBeenCalledWith(ARCHIVED_ROW))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ isActive: false })
    expect(cachedTrackers(queryClient)).toEqual([ARCHIVED_ROW, OTHER_ROW])
  })

  it("reports a failed archive instead of silently leaving the cache stale", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse({ error: "Failed to update tracker" }, { ok: false, status: 500 })
    const { queryClient, onArchived } = renderBanner()

    await user.click(screen.getByRole("button", { name: "Archive Now?" }))

    expect(await screen.findByText("Failed to update tracker")).toBeInTheDocument()
    expect(onArchived).not.toHaveBeenCalled()
    expect(cachedTrackers(queryClient)).toEqual([CACHED_ROW, OTHER_ROW])
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(false)
  })
})

describe("TrackerDefunctBanner on an already-archived tracker", () => {
  const archived = { ...TRACKER, isActive: false }

  it("still explains the shutdown but offers no archive button", () => {
    renderBanner({ tracker: archived })

    expect(screen.getByText(/FearNoPeer has shut down\./)).toBeInTheDocument()
    expect(screen.getByText("May 11, 2026")).toBeInTheDocument()
    expect(archiveButton()).not.toBeInTheDocument()
    expect(screen.getByText(/This tracker is archived/)).toBeInTheDocument()
  })

  it("offers no archive button in the compact variant either", () => {
    renderBanner({ tracker: archived, variant: "compact" })

    expect(screen.getByText(/Defunct/)).toBeInTheDocument()
    expect(archiveButton()).not.toBeInTheDocument()
  })
})
