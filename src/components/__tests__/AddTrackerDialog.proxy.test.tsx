// src/components/__tests__/AddTrackerDialog.proxy.test.tsx
//
// The key test and the first poll must take the same route. The dialog offers
// the proxy only when the settings read says it can be used, on by default, and
// sends the choice to both requests. Until it knows, it sends nothing, and the
// server's own default keeps a set-up proxy in use.

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"

const fetchMock = vi.fn()
const NONE_HELD: ReadonlyMap<string, boolean> = new Map()

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

/** The body each tracker request was sent with, by URL. */
function sentBodies(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST" && init.body !== undefined)
      .map(([url, init]) => [String(url), JSON.parse(String(init.body))])
  )
}

function serveSettings(settings: Promise<unknown>) {
  fetchMock.mockImplementation(async (url: unknown) => {
    const target = String(url)
    if (target === "/api/settings") return settings
    if (target === "/api/trackers/test-connection") {
      return jsonResponse({ username: "someone", group: "User" })
    }
    if (target === "/api/trackers") return jsonResponse({ id: 99 })
    return jsonResponse({})
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

async function addAither(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Search trackers..."), "Aither")
  await user.keyboard("{Enter}")
  await user.type(screen.getByLabelText("API Token"), "fresh-token")
  await user.click(screen.getByRole("button", { name: "Add Tracker" }))
}

function renderDialog() {
  render(<AddTrackerDialog open heldSlugs={NONE_HELD} onClose={vi.fn()} onAdded={vi.fn()} />)
}

describe("AddTrackerDialog proxy choice", () => {
  it("offers the proxy on by default when it can be used, and sends that to both requests", async () => {
    const user = userEvent.setup()
    serveSettings(Promise.resolve(jsonResponse({ proxyUsable: true })))
    renderDialog()

    expect(await screen.findByRole("switch", { name: "Use proxy" })).toBeChecked()
    await addAither(user)

    await waitFor(() => expect(sentBodies()["/api/trackers"]).toBeDefined())
    expect(sentBodies()["/api/trackers/test-connection"]).toMatchObject({ useProxy: true })
    expect(sentBodies()["/api/trackers"]).toMatchObject({ useProxy: true })
  })

  it("sends false to both requests once the toggle is turned off", async () => {
    const user = userEvent.setup()
    serveSettings(Promise.resolve(jsonResponse({ proxyUsable: true })))
    renderDialog()

    await user.click(await screen.findByRole("switch", { name: "Use proxy" }))
    await addAither(user)

    await waitFor(() => expect(sentBodies()["/api/trackers"]).toBeDefined())
    expect(sentBodies()["/api/trackers/test-connection"]).toMatchObject({ useProxy: false })
    expect(sentBodies()["/api/trackers"]).toMatchObject({ useProxy: false })
  })

  it("offers no toggle and sends no choice when the proxy can't be used", async () => {
    const user = userEvent.setup()
    serveSettings(Promise.resolve(jsonResponse({ proxyEnabled: true, proxyUsable: false })))
    renderDialog()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings"))
    await addAither(user)

    await waitFor(() => expect(sentBodies()["/api/trackers"]).toBeDefined())
    expect(screen.queryByRole("switch", { name: "Use proxy" })).toBeNull()
    expect(sentBodies()["/api/trackers/test-connection"]).not.toHaveProperty("useProxy")
    expect(sentBodies()["/api/trackers"]).not.toHaveProperty("useProxy")
  })

  // A slow settings read must not turn into a direct add.
  it("sends no choice while the settings read is still out", async () => {
    const user = userEvent.setup()
    serveSettings(new Promise(() => {}))
    renderDialog()

    await addAither(user)

    await waitFor(() => expect(sentBodies()["/api/trackers"]).toBeDefined())
    expect(sentBodies()["/api/trackers/test-connection"]).not.toHaveProperty("useProxy")
    expect(sentBodies()["/api/trackers"]).not.toHaveProperty("useProxy")
  })
})
