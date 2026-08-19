// src/components/TrackerSettingsSheet.test.tsx
//
// Two things are pinned here.
//
// 1. The Last Login shortcut sits mid-form, so it must not write on its own: an immediate
//    single-field PATCH would discard whatever else the user had already typed into the sheet.
//    These tests pin it as a field shortcut — it fills the date, and the ordinary Save is what
//    persists it, alongside every other edit.
//
// 2. Every write in this sheet mutates a row that lives in the shared ["trackers"] query cache,
//    which the sidebar and the dashboard render from. That cache is not remounted by navigating
//    home, and its only automatic repair is a poll interval measured in tens of minutes. The
//    archive path used to leave it completely untouched, so an archived tracker kept rendering
//    as active. These tests assert the write-through + invalidation, and that a failed archive
//    says so instead of silently doing nothing.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { localDateStr } from "@/lib/formatters"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { TrackerSettingsSheet } from "./TrackerSettingsSheet"

const TRACKER: TrackerSummary = {
  id: 42,
  name: "Aither",
  baseUrl: "https://aither.cc",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#01d4ff",
  qbtTag: "aither",
  mouseholeUrl: null,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  hideUnreadBadges: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: "2026-01-05",
  remoteUserId: null,
  platformMeta: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  latestStats: null,
}

/** A second row so the tests can prove only the edited tracker is rewritten. */
const OTHER: TrackerSummary = { ...TRACKER, id: 7, name: "Orpheus", qbtTag: "ops" }

const ARCHIVED: TrackerSummary = { ...TRACKER, isActive: false }

const fetchMock = vi.fn()

/** Every call the sheet made to this tracker's own PATCH/DELETE endpoint. */
function trackerRequests() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/trackers/"))
}

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

/**
 * What PATCH /api/trackers/42 answers. The real route re-reads the row and returns
 * it, which is what lets callers skip a follow-up GET — tests must model that.
 */
let patchResult = jsonResponse(ARCHIVED)

function renderSheet(overrides: Partial<Parameters<typeof TrackerSettingsSheet>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(trackerQueryOptions.queryKey, [TRACKER, OTHER])

  const props = {
    open: true,
    tracker: TRACKER,
    onClose: vi.fn(),
    onUpdated: vi.fn(),
    ...overrides,
  }
  render(
    <QueryClientProvider client={queryClient}>
      <TrackerSettingsSheet {...props} />
    </QueryClientProvider>
  )
  return { ...props, queryClient }
}

function cachedTrackers(queryClient: QueryClient) {
  return queryClient.getQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey)
}

beforeEach(() => {
  fetchMock.mockReset()
  pushMock.mockReset()
  patchResult = jsonResponse(ARCHIVED)
  fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    const target = String(url)
    // The sheet fetches /api/settings on open to learn whether a proxy is configured.
    if (target === "/api/settings") return jsonResponse({ proxyEnabled: false })
    if (target === "/api/trackers/42") {
      if (init?.method === "DELETE") return jsonResponse({ success: true })
      return patchResult
    }
    return jsonResponse({})
  })
  vi.stubGlobal("fetch", fetchMock)
})

describe("TrackerSettingsSheet last login shortcut", () => {
  it("fills today's date without writing or closing the sheet", async () => {
    const user = userEvent.setup()
    const props = renderSheet()

    await user.click(screen.getByRole("button", { name: "Today" }))

    expect(screen.getByLabelText("Last Login")).toHaveValue(localDateStr())
    expect(trackerRequests()).toEqual([])
    expect(props.onUpdated).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it("keeps unsaved edits made elsewhere in the form", async () => {
    const user = userEvent.setup()
    renderSheet()

    const nickname = screen.getByLabelText("Nickname")
    await user.clear(nickname)
    await user.type(nickname, "Aither (main)")

    await user.click(screen.getByRole("button", { name: "Today" }))

    expect(nickname).toHaveValue("Aither (main)")
    expect(trackerRequests()).toEqual([])
  })

  it("persists the shortcut's date through the ordinary Save, with the other edits", async () => {
    const user = userEvent.setup()
    const props = renderSheet()

    const nickname = screen.getByLabelText("Nickname")
    await user.clear(nickname)
    await user.type(nickname, "Aither (main)")
    await user.click(screen.getByRole("button", { name: "Today" }))
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    expect(saveCall[0]).toBe("/api/trackers/42")
    expect(saveCall[1].method).toBe("PATCH")
    expect(JSON.parse(saveCall[1].body)).toMatchObject({
      name: "Aither (main)",
      lastAccessAt: localDateStr(),
    })
    await waitFor(() => expect(props.onUpdated).toHaveBeenCalledTimes(1))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe("TrackerSettingsSheet shared tracker cache", () => {
  it("writes the archived row into the shared tracker cache and invalidates it", async () => {
    const user = userEvent.setup()
    const { queryClient, onUpdated, onClose } = renderSheet()

    await user.click(screen.getByRole("button", { name: "Archive" }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalled())

    // Write-through: the sidebar's own filter (`showArchived || t.isActive`) and its
    // archivedCount both read this array directly.
    expect(cachedTrackers(queryClient)).toEqual([ARCHIVED, OTHER])

    // And the entry is marked stale so the next observer confirms against the server
    // instead of trusting the optimistic row for the rest of the poll interval.
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(true)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("hands the PATCH response to onUpdated so callers need no follow-up GET", async () => {
    const user = userEvent.setup()
    const { onUpdated } = renderSheet()

    await user.click(screen.getByRole("button", { name: "Archive" }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(ARCHIVED))
    // Exactly one request to this tracker: the PATCH. No read-back round trip.
    expect(trackerRequests()).toHaveLength(1)
  })

  it("reports a failed archive instead of silently leaving the cache stale", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse({ error: "Failed to update tracker" }, { ok: false, status: 500 })
    const { queryClient, onUpdated, onClose } = renderSheet()

    await user.click(screen.getByRole("button", { name: "Archive" }))

    expect(await screen.findByText("Failed to update tracker")).toBeInTheDocument()
    expect(onUpdated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(cachedTrackers(queryClient)).toEqual([TRACKER, OTHER])
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(false)
  })

  it("invalidates the shared cache after an ordinary save too", async () => {
    const user = userEvent.setup()
    const renamed: TrackerSummary = { ...TRACKER, name: "Aither (main)" }
    patchResult = jsonResponse(renamed)
    const { queryClient, onUpdated } = renderSheet()

    const nickname = screen.getByLabelText("Nickname")
    await user.clear(nickname)
    await user.type(nickname, "Aither (main)")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(renamed))
    expect(cachedTrackers(queryClient)).toEqual([renamed, OTHER])
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(true)
  })

  it("drops the deleted row from the shared cache before navigating home", async () => {
    const user = userEvent.setup()
    const { queryClient } = renderSheet()

    await user.click(screen.getByRole("button", { name: "Delete" }))
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"))
    expect(cachedTrackers(queryClient)).toEqual([OTHER])
    expect(queryClient.getQueryState(trackerQueryOptions.queryKey)?.isInvalidated).toBe(true)
  })
})
