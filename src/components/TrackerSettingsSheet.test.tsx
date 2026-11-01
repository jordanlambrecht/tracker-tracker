// src/components/TrackerSettingsSheet.test.tsx
//
// Two things are pinned here.
//
// 1. The Last Login shortcut sits mid-form, so it must not write on its own: an immediate
//    single-field PATCH would discard whatever else the user had already typed into the sheet.
//    These tests pin it as a field shortcut, it fills the date, and the ordinary Save is what
//    persists it, alongside every other edit.
//
// 2. Every write in this sheet mutates a row that lives in the shared ["trackers"] query cache,
//    which the sidebar and the dashboard render from. That cache is not remounted by navigating
//    home, and its only automatic repair is a poll interval measured in tens of minutes. An
//    archive that skips the cache leaves the tracker rendering as active. These tests assert the
//    write-through + invalidation, and that a failed archive says so instead of silently doing
//    nothing.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
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
  registrySlug: null,
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
  mouseholePublicUrl: null,
  hasMouseholeToken: false,
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
 * it, which is what lets callers skip a follow-up GET, tests must model that.
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

describe("TrackerSettingsSheet Mousehole API token", () => {
  const MAM: TrackerSummary = {
    ...TRACKER,
    platformType: "mam",
    mouseholeUrl: "http://mousehole-test:5010",
    mouseholePublicUrl: null,
    hasMouseholeToken: true,
  }

  // The saved token is masked, so a value typed and then abandoned would be
  // invisible on the next open and ride along with an unrelated save.
  it("drops a typed token on close, so a later save leaves the saved one alone", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(MAM)
    renderSheet({ tracker: MAM })

    // The credentials row has its own Change button; the Mousehole one is second.
    await user.click(screen.getAllByRole("button", { name: "Change" })[1])
    await user.type(screen.getByLabelText("Mousehole API token"), "abandoned-token-7f3a")
    await user.click(screen.getByRole("button", { name: "Close" }))

    const nickname = screen.getByLabelText("Nickname")
    await user.clear(nickname)
    await user.type(nickname, "MAM (main)")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    expect(saveCall[1].method).toBe("PATCH")
    expect(JSON.parse(saveCall[1].body)).not.toHaveProperty("mouseholeToken")
  })

  it("sends a typed token with the save", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(MAM)
    renderSheet({ tracker: MAM })

    await user.click(screen.getAllByRole("button", { name: "Change" })[1])
    await user.type(screen.getByLabelText("Mousehole API token"), "fake-token-7f3a")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    expect(JSON.parse(saveCall[1].body)).toMatchObject({ mouseholeToken: "fake-token-7f3a" })
  })

  it("returns to the masked token and sends nothing after Cancel", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(MAM)
    renderSheet({ tracker: MAM })

    await user.click(screen.getAllByRole("button", { name: "Change" })[1])
    const field = screen.getByLabelText("Mousehole API token")
    await user.type(field, "abandoned-token-7f3a")
    // The sheet footer has its own Cancel; the field's sits in the field's
    // container, two levels above the input.
    const row = field.parentElement?.parentElement as HTMLElement
    await user.click(within(row).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByLabelText("Mousehole API token")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    expect(JSON.parse(saveCall[1].body)).not.toHaveProperty("mouseholeToken")
  })

  // An empty URL clears the token on the server, so a save that leaves the URL
  // alone must send it back unchanged.
  it("resends the saved URL, so an unrelated save keeps the token", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(MAM)
    renderSheet({ tracker: MAM })

    const nickname = screen.getByLabelText("Nickname")
    await user.clear(nickname)
    await user.type(nickname, "MAM (main)")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    const body = JSON.parse(saveCall[1].body)
    expect(body).toMatchObject({ mouseholeUrl: "http://mousehole-test:5010" })
    expect(body).not.toHaveProperty("mouseholeToken")
  })

  it("sends an empty URL when the Mousehole URL is removed", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse({ ...MAM, mouseholeUrl: null, hasMouseholeToken: false })
    renderSheet({ tracker: MAM })

    await user.clear(screen.getByLabelText("Mousehole URL (optional)"))
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    const body = JSON.parse(saveCall[1].body)
    expect(body).toMatchObject({ mouseholeUrl: "" })
    expect(body).not.toHaveProperty("mouseholeToken")
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

// ---------------------------------------------------------------------------
// This sheet rebuilds the DigitalCore blob from scratch, and the stored token
// never reaches the client, so it cannot preserve a UA it was not given.
// Dropping the capture silently reverts the tracker to the default UA.
// ---------------------------------------------------------------------------

describe("TrackerSettingsSheet digitalcore credentials", () => {
  const DC_TRACKER: TrackerSummary = {
    ...TRACKER,
    platformType: "digitalcore",
    baseUrl: "https://digitalcore.club",
    registrySlug: null,
  }

  it("labels the credential section Credentials rather than API Key", () => {
    renderSheet({ tracker: DC_TRACKER })
    expect(screen.getByText("Credentials")).toBeInTheDocument()
    expect(screen.queryByText("API Key")).not.toBeInTheDocument()
  })

  it("persists the browser User-Agent when the cookies are changed", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(DC_TRACKER)
    renderSheet({ tracker: DC_TRACKER })

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText(/session cookies/i), "uid=56954; pass=abc123def456")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(trackerRequests().length).toBeGreaterThan(0))

    const body = JSON.parse(String(trackerRequests().at(-1)?.[1]?.body))
    const blob = JSON.parse(body.apiToken)
    expect(blob.uid).toBe("56954")
    expect(blob.pass).toBe("abc123def456")
    expect(blob.userAgent).toBe(navigator.userAgent)
  })
})

describe("TrackerSettingsSheet torrentleech credentials", () => {
  const TL_TRACKER: TrackerSummary = {
    ...TRACKER,
    platformType: "torrentleech",
    baseUrl: "https://www.torrentleech.org",
    registrySlug: null,
  }

  it("includes the Alt 2FA Token in the blob only when one is entered", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(TL_TRACKER)
    renderSheet({ tracker: TL_TRACKER })

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Username"), "bob")
    await user.type(screen.getByLabelText("Password"), "hunter2")
    await user.type(screen.getByLabelText("Alt 2FA Token (optional)"), "tok123")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(trackerRequests().length).toBeGreaterThan(0))
    const blob = JSON.parse(JSON.parse(String(trackerRequests().at(-1)?.[1]?.body)).apiToken)
    expect(blob).toEqual({ username: "bob", password: "hunter2", alt2FAToken: "tok123" })
  })

  it("omits the token key for accounts without 2FA", async () => {
    const user = userEvent.setup()
    patchResult = jsonResponse(TL_TRACKER)
    renderSheet({ tracker: TL_TRACKER })

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Username"), "bob")
    await user.type(screen.getByLabelText("Password"), "hunter2")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(trackerRequests().length).toBeGreaterThan(0))
    const blob = JSON.parse(JSON.parse(String(trackerRequests().at(-1)?.[1]?.body)).apiToken)
    expect("alt2FAToken" in blob).toBe(false)
  })

  it("wipes the typed secrets when the sheet is cancelled", async () => {
    // Closing must clear the password and token, or the next Change click shows
    // them again.
    const user = userEvent.setup()
    renderSheet({ tracker: TL_TRACKER })

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Password"), "hunter2")
    await user.type(screen.getByLabelText("Alt 2FA Token (optional)"), "tok123")
    await user.click(screen.getByRole("button", { name: "Close panel" }))

    await user.click(screen.getByRole("button", { name: "Change" }))
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByLabelText("Alt 2FA Token (optional)")).toHaveValue("")
  })
})

describe("TrackerSettingsSheet registry data", () => {
  // The row names its registry entry by slug. A stored URL that happens to
  // match an entry is a poll address, not a key.
  const loginHint = () => screen.queryByText(/no login-interval policy/i)

  it("reads the login policy from the slug, not the stored URL", () => {
    renderSheet({
      tracker: { ...TRACKER, registrySlug: "aither", baseUrl: "https://moved-since.test" },
    })
    expect(loginHint()).toBeNull()
  })

  it("offers no registry rules to a row with no slug", () => {
    renderSheet({ tracker: { ...TRACKER, registrySlug: null, baseUrl: "https://aither.cc" } })
    expect(loginHint()).toBeInTheDocument()
  })
})

describe("TrackerSettingsSheet base URL", () => {
  // The URL is registry data copied in when the tracker was added, so the sheet
  // neither shows a field for it nor sends one; the row keeps what the registry gave it.
  it("offers no field for the tracker URL and sends none on save", async () => {
    const user = userEvent.setup()
    renderSheet()

    expect(screen.queryByLabelText("Base URL")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const [saveCall] = trackerRequests()
    expect(saveCall[1].method).toBe("PATCH")
    expect(JSON.parse(saveCall[1].body)).not.toHaveProperty("baseUrl")
  })
})
