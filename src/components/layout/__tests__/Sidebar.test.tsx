// src/components/layout/__tests__/Sidebar.test.tsx
//
// The sidebar wires the stored preferences and the shared tracker list to what
// it draws. Its own decisions: which row is the open page, when archived rows
// show, when reordering is off, that Log Out leaves only once the session is
// gone, and that a collapsed sidebar takes no room.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import type { TrackerSummary } from "@/types/api"

let pathname = "/"
const push = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}))

vi.mock("@/hooks/useUpdateCheck", () => ({
  useUpdateCheck: () => ({ latestVersion: null, updateAvailable: false }),
}))

vi.mock("@/components/layout/DownloadClientStatusWidget", () => ({
  DownloadClientStatusWidget: () => null,
}))

vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: () => null,
}))

import { Sidebar } from "@/components/layout/Sidebar"

function tracker(id: number, name: string, overrides: Partial<TrackerSummary> = {}) {
  return {
    id,
    name,
    baseUrl: `https://${name.toLowerCase()}.example.test`,
    registrySlug: name.toLowerCase(),
    linked: true,
    duplicateOf: null,
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    isFavorite: false,
    sortOrder: null,
    latestStats: null,
    ...overrides,
  } as TrackerSummary
}

// Each URL the sidebar's hooks fetch. A test replaces an entry to hold a
// response back.
let responses: Record<string, () => Promise<Response>>
const fetchMock = vi.fn((url: string) => {
  const respond = responses[url]
  return respond ? respond() : Promise.resolve(new Response("{}"))
})

function answerTrackers(list: TrackerSummary[]) {
  responses["/api/trackers"] = async () => new Response(JSON.stringify(list))
}

function renderSidebar(onToggle: () => void = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const sidebar = (collapsed: boolean) => (
    <QueryClientProvider client={queryClient}>
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
    </QueryClientProvider>
  )
  const view = render(sidebar(false))
  return { ...view, setCollapsed: (collapsed: boolean) => view.rerender(sidebar(collapsed)) }
}

beforeEach(() => {
  pathname = "/"
  push.mockReset()
  localStorage.clear()
  responses = {
    "/api/settings": async () => new Response(JSON.stringify({ trackerPollIntervalMinutes: 60 })),
  }
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Sidebar", () => {
  it("marks the tracker whose page is open, and not the dashboard", async () => {
    pathname = "/trackers/2"
    answerTrackers([tracker(1, "Aither"), tracker(2, "Blutopia")])
    renderSidebar()

    expect(await screen.findByRole("link", { name: /Blutopia/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: /Aither/ })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("button", { name: "Go to dashboard" })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("marks the dashboard at the root", async () => {
    answerTrackers([tracker(1, "Aither")])
    renderSidebar()

    await screen.findByRole("link", { name: /Aither/ })
    expect(screen.getByRole("button", { name: "Go to dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("lists an archived tracker only once Show Archived is on", async () => {
    const user = userEvent.setup()
    answerTrackers([tracker(1, "Aither"), tracker(3, "Cathode", { isActive: false })])
    renderSidebar()

    await screen.findByRole("link", { name: /Aither/ })
    expect(screen.queryByRole("link", { name: /Cathode/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show Archived (1)" }))

    expect(screen.getByRole("link", { name: /Cathode/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hide Archived (1)" })).toBeInTheDocument()
  })

  it("offers no archive toggle when nothing is archived", async () => {
    answerTrackers([tracker(1, "Aither")])
    renderSidebar()

    await screen.findByRole("link", { name: /Aither/ })
    expect(screen.queryByRole("button", { name: /Archived/ })).not.toBeInTheDocument()
  })

  it("turns reordering off while the list is sorted by a stat, even when unlocked", async () => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_SORT_MODE, JSON.stringify("stat"))
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_UNLOCKED, JSON.stringify(true))
    answerTrackers([tracker(1, "Aither")])
    renderSidebar()

    await screen.findByRole("link", { name: /Aither/ })
    expect(
      screen.getByRole("button", { name: "Reordering is disabled while sorted by datapoint" })
    ).toBeDisabled()
  })

  it("shows loading rows rather than the empty line until the list arrives", async () => {
    let finish: (list: TrackerSummary[]) => void = () => {}
    responses["/api/trackers"] = () =>
      new Promise((resolve) => {
        finish = (list) => resolve(new Response(JSON.stringify(list)))
      })
    renderSidebar()

    expect(screen.queryByText("No trackers added yet.")).not.toBeInTheDocument()
    finish([])
    expect(await screen.findByText("No trackers added yet.")).toBeInTheDocument()
  })

  it("leaves for the login page only once the logout has answered", async () => {
    const user = userEvent.setup()
    answerTrackers([])
    let finishLogout: () => void = () => {}
    responses["/api/auth/logout"] = () =>
      new Promise((resolve) => {
        finishLogout = () => resolve(new Response(null, { status: 204 }))
      })
    renderSidebar()

    await user.click(screen.getByRole("button", { name: /Log Out/ }))
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" })
    expect(push).not.toHaveBeenCalled()

    finishLogout()
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"))
  })

  it("collapses from its own button, and takes no width once collapsed", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    answerTrackers([])
    const { container, setCollapsed } = renderSidebar(onToggle)
    expect(container.querySelector("aside")).not.toHaveStyle({ width: "0px" })

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(onToggle).toHaveBeenCalledTimes(1)

    setCollapsed(true)
    expect(container.querySelector("aside")).toHaveStyle({ width: "0px" })
  })
})
