// src/components/TrackerSettingsSheet.test.tsx
//
// The Last Login shortcut sits mid-form, so it must not write on its own: an immediate
// single-field PATCH would discard whatever else the user had already typed into the sheet.
// These tests pin it as a field shortcut — it fills the date, and the ordinary Save is what
// persists it, alongside every other edit.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { localDateStr } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

const fetchMock = vi.fn()

/** Every call the sheet made to this tracker's own PATCH/DELETE endpoint. */
function trackerRequests() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/trackers/"))
}

function renderSheet(overrides: Partial<Parameters<typeof TrackerSettingsSheet>[0]> = {}) {
  const props = {
    open: true,
    tracker: TRACKER,
    onClose: vi.fn(),
    onUpdated: vi.fn(),
    ...overrides,
  }
  render(<TrackerSettingsSheet {...props} />)
  return props
}

beforeEach(() => {
  fetchMock.mockReset()
  // The sheet fetches /api/settings on open to learn whether a proxy is configured.
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ proxyEnabled: false }),
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
    expect(props.onUpdated).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
