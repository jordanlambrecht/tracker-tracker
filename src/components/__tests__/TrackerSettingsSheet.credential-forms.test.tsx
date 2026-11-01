// src/components/__tests__/TrackerSettingsSheet.credential-forms.test.tsx
//
// The sheet reads the same table as the dialog for cookie checks and Join Date
// visibility; pins the message for a bare cookie name pasted on its own.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { VALID_PLATFORM_TYPES } from "@/data/platform-types"
import { CREDENTIAL_FORMS } from "@/lib/credential-forms"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { TrackerSettingsSheet } from "@/components/TrackerSettingsSheet"

const RETROTOON: TrackerSummary = {
  id: 42,
  name: "RetroToon World",
  baseUrl: "https://retrotoon.world",
  registrySlug: null,
  platformType: "retrotoon",
  isActive: true,
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#01d4ff",
  qbtTag: "retrotoon",
  mouseholeUrl: null,
  mouseholePublicUrl: null,
  hasMouseholeToken: false,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  hideUnreadBadges: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  latestStats: null,
}

const fetchMock = vi.fn()

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

// Reads the sheet makes on open, which touch no credential.
const OPEN_READS = new Set(["/api/settings", "/api/prowlarr/indexers"])

/** Every call that would have written or verified the credential. */
function credentialRequests() {
  return fetchMock.mock.calls.filter(([url]) => !OPEN_READS.has(String(url)))
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: unknown) => {
    const target = String(url)
    if (target === "/api/settings") return jsonResponse({ proxyEnabled: false })
    if (target === "/api/trackers/test-connection") return jsonResponse({ username: "someone" })
    return jsonResponse(RETROTOON)
  })
  vi.stubGlobal("fetch", fetchMock)
})

/** The body of the credential re-test, or null if the sheet never sent one. */
function testConnectionBody(): Record<string, unknown> | null {
  const call = fetchMock.mock.calls.find(([url]) => String(url) === "/api/trackers/test-connection")
  return call ? JSON.parse(String(call[1]?.body)) : null
}

function renderSheet(tracker: TrackerSummary = RETROTOON) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(trackerQueryOptions.queryKey, [tracker])
  render(
    <QueryClientProvider client={queryClient}>
      <TrackerSettingsSheet open tracker={tracker} onClose={vi.fn()} onUpdated={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("TrackerSettingsSheet cookie credentials", () => {
  it("says a bare cookie name is a name, not a malformed cookie string", async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Browser Cookies"), "PHPSESSID")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText(/you pasted a cookie name \("PHPSESSID"\)/)).toBeInTheDocument()
    expect(credentialRequests()).toEqual([])
  })

  it("stores the cookies with this browser's user agent", async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Browser Cookies"), "Cookie: PHPSESSID=abc123")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(credentialRequests().length).toBeGreaterThan(0))
    const patch = credentialRequests().find(([, init]) => init?.method === "PATCH")
    const blob = JSON.parse(JSON.parse(String(patch?.[1]?.body)).apiToken)
    expect(blob).toEqual({ cookies: "PHPSESSID=abc123", userAgent: navigator.userAgent })
  })
})

// ---------------------------------------------------------------------------
// The credential re-test before a save. The route derives the address and the
// platform from the registry entry a slug names, so a row that has one sends
// the slug alone; a pre-registry row still sends what it stores.
// ---------------------------------------------------------------------------

describe("TrackerSettingsSheet credential re-test", () => {
  async function changeCookies(tracker: TrackerSummary) {
    const user = userEvent.setup()
    renderSheet(tracker)
    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Browser Cookies"), "Cookie: PHPSESSID=abc123")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))
    await waitFor(() => expect(testConnectionBody()).not.toBeNull())
    return testConnectionBody() as Record<string, unknown>
  }

  it("names the tracker by slug when the row has one", async () => {
    const body = await changeCookies({ ...RETROTOON, registrySlug: "retrotoon" })
    expect(body.slug).toBe("retrotoon")
    expect(body).not.toHaveProperty("baseUrl")
    expect(body).not.toHaveProperty("platformType")
  })

  it("sends the stored address and platform for a row with no slug", async () => {
    const body = await changeCookies(RETROTOON)
    expect(body.baseUrl).toBe(RETROTOON.baseUrl)
    expect(body.platformType).toBe("retrotoon")
    expect(body).not.toHaveProperty("slug")
  })
})

describe("TrackerSettingsSheet AnimeBytes credentials", () => {
  const ANIMEBYTES: TrackerSummary = {
    ...RETROTOON,
    name: "AnimeBytes",
    baseUrl: "https://animebytes.tv",
    registrySlug: "animebytes",
    platformType: "animebytes",
  }

  it("asks for the username and the API token, and saves both as one blob", async () => {
    // The adapter reads the username from the blob, since the API never reports it.
    const user = userEvent.setup()
    renderSheet(ANIMEBYTES)

    await user.click(screen.getByRole("button", { name: "Change" }))
    await user.type(screen.getByLabelText("Username"), "someone")
    await user.type(screen.getByLabelText("API Token"), "tok123")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() =>
      expect(credentialRequests().some(([, init]) => init?.method === "PATCH")).toBe(true)
    )
    const blob = { token: "tok123", username: "someone" }
    const test = testConnectionBody() as Record<string, unknown>
    expect(test.slug).toBe("animebytes")
    expect(JSON.parse(String(test.apiToken))).toEqual(blob)
    const patch = credentialRequests().find(([, init]) => init?.method === "PATCH")
    expect(JSON.parse(JSON.parse(String(patch?.[1]?.body)).apiToken)).toEqual(blob)
  })
})

describe("TrackerSettingsSheet join date visibility", () => {
  // Split by the table's flag, so a platform added to the table is covered
  // here too. Enrichment is per tracker, so that case names its registry entry.
  const JOIN_DATE = "Join Date"
  const HIDDEN = VALID_PLATFORM_TYPES.filter((p) => CREDENTIAL_FORMS[p].hidesJoinDate)
  const SHOWN = VALID_PLATFORM_TYPES.filter((p) => !CREDENTIAL_FORMS[p].hidesJoinDate)

  it.each(HIDDEN)("hides it for %s", (platformType) => {
    renderSheet({ ...RETROTOON, platformType })
    expect(screen.queryByLabelText(JOIN_DATE)).not.toBeInTheDocument()
  })

  it.each(SHOWN)("shows it for %s", (platformType) => {
    renderSheet({ ...RETROTOON, platformType })
    expect(screen.getByLabelText(JOIN_DATE)).toBeInTheDocument()
  })

  it("hides it for a gazelle tracker whose registry entry enriches", () => {
    renderSheet({ ...RETROTOON, platformType: "gazelle", registrySlug: "orpheus" })
    expect(screen.queryByLabelText(JOIN_DATE)).not.toBeInTheDocument()
  })
})
