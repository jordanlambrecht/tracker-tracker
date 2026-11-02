// src/components/tracker-detail/__tests__/LinkTrackerDialog.test.tsx
//
// Linking moves a row to a tracker on another host, so the dialog asks for the
// key in the picked tracker's own form and tests it there before it links. A key
// typed for one tracker is never sent to another, a failed test links nothing,
// and the picker offers what Add Tracker does: no tracker that shut down, and
// none another row already uses.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LinkTrackerDialog } from "@/components/tracker-detail/LinkTrackerDialog"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"

const DEFUNCT = TRACKER_REGISTRY.find((t) => t.defunct)
if (!DEFUNCT) throw new Error("the registry has no defunct entry left to test with")

const NONE_HELD: ReadonlyMap<string, boolean> = new Map()
const LINKED_ROW = { id: 42, linked: true, registrySlug: "aither" }

const fetchMock = vi.fn()

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

function respond(responses: Record<string, ReturnType<typeof jsonResponse>>) {
  fetchMock.mockImplementation(async (url: string) => responses[url] ?? jsonResponse({}))
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

function renderDialog(heldSlugs = NONE_HELD) {
  const onLinked = vi.fn()
  render(
    <LinkTrackerDialog
      open
      onClose={vi.fn()}
      trackerId={42}
      heldSlugs={heldSlugs}
      onLinked={onLinked}
    />
  )
  return { onLinked }
}

const startsWith = (name: string) => (accessible: string) => accessible.startsWith(name)

/** Opens the picker, which shows the current pick until clicked, and picks `name`. */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox"))
  await user.type(within(screen.getByRole("combobox")).getByRole("textbox"), name)
  await user.click(screen.getByRole("option", { name: startsWith(name) }))
}

function requests() {
  return fetchMock.mock.calls.map(([url, init]) => [
    url,
    init.body === undefined ? init.method : JSON.parse(init.body),
  ])
}

describe("LinkTrackerDialog", () => {
  it("leaves out a tracker that shut down and won't pick one already in use", async () => {
    const user = userEvent.setup()
    renderDialog(new Map([["aither", false]]))

    await user.type(screen.getByPlaceholderText("Search trackers..."), DEFUNCT.name)
    expect(screen.getByText("No matches")).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText("Search trackers..."))
    await user.type(screen.getByPlaceholderText("Search trackers..."), "Aither")
    expect(screen.getByRole("option", { name: startsWith("Aither") })).toBeDisabled()
  })

  it("asks for the key in the picked tracker's own form", async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.queryByLabelText("API Token")).toBeNull()
    await pick(user, "Aither")
    expect(screen.getByLabelText("API Token")).toBeInTheDocument()

    await pick(user, "DigitalCore")
    expect(screen.queryByLabelText("API Token")).toBeNull()
    expect(screen.getByLabelText("Session Cookies")).toBeInTheDocument()
  })

  // The first poll is fired and not waited on, as Add Tracker does after a create.
  it("tests the key on the picked tracker, links with it, then starts a poll", async () => {
    const user = userEvent.setup()
    respond({
      "/api/trackers/test-connection": jsonResponse({ username: "someone", group: "User" }),
      "/api/trackers/42/link": jsonResponse(LINKED_ROW),
    })
    const { onLinked } = renderDialog()

    await pick(user, "Aither")
    await user.type(screen.getByLabelText("API Token"), "fresh-token")
    await user.click(screen.getByRole("button", { name: "Link" }))

    expect(requests()).toEqual([
      ["/api/trackers/test-connection", { slug: "aither", apiToken: "fresh-token" }],
      ["/api/trackers/42/link", { slug: "aither", apiToken: "fresh-token" }],
      ["/api/trackers/42/poll", "POST"],
    ])
    expect(onLinked).toHaveBeenCalledWith(LINKED_ROW)
  })

  it("starts no poll on a row the user paused", async () => {
    const user = userEvent.setup()
    const paused = { ...LINKED_ROW, userPausedAt: "2026-11-01T09:00:00.000Z" }
    respond({
      "/api/trackers/test-connection": jsonResponse({ username: "someone", group: "User" }),
      "/api/trackers/42/link": jsonResponse(paused),
    })
    const { onLinked } = renderDialog()

    await pick(user, "Aither")
    await user.type(screen.getByLabelText("API Token"), "fresh-token")
    await user.click(screen.getByRole("button", { name: "Link" }))

    expect(onLinked).toHaveBeenCalledWith(paused)
    expect(requests().map(([url]) => url)).not.toContain("/api/trackers/42/poll")
  })

  it("links nothing when the key fails its test, and says why under the key", async () => {
    const user = userEvent.setup()
    respond({
      "/api/trackers/test-connection": jsonResponse(
        { error: "Invalid API key" },
        { ok: false, status: 422 }
      ),
    })
    const { onLinked } = renderDialog()

    await pick(user, "Aither")
    await user.type(screen.getByLabelText("API Token"), "wrong-token")
    await user.click(screen.getByRole("button", { name: "Link" }))

    expect(await screen.findByLabelText("API Token")).toHaveAccessibleDescription("Invalid API key")
    expect(requests().map(([url]) => url)).toEqual(["/api/trackers/test-connection"])
    expect(onLinked).not.toHaveBeenCalled()
  })

  it("shows the link's refusal and keeps the row as it was", async () => {
    const user = userEvent.setup()
    respond({
      "/api/trackers/test-connection": jsonResponse({ username: "someone", group: "User" }),
      "/api/trackers/42/link": jsonResponse(
        { error: "You already track Aither" },
        { ok: false, status: 409 }
      ),
    })
    const { onLinked } = renderDialog()

    await pick(user, "Aither")
    await user.type(screen.getByLabelText("API Token"), "fresh-token")
    await user.click(screen.getByRole("button", { name: "Link" }))

    expect(await screen.findByText("You already track Aither")).toBeInTheDocument()
    expect(onLinked).not.toHaveBeenCalled()
  })

  it("sends nothing until a tracker is picked", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("button", { name: "Link" }))

    expect(screen.getByText("Select a tracker")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("drops a key typed for one tracker when another is picked", async () => {
    const user = userEvent.setup()
    renderDialog()

    await pick(user, "Aither")
    await user.type(screen.getByLabelText("API Token"), "aither-token")
    await pick(user, "Blutopia")

    expect(screen.getByLabelText("API Token")).toHaveValue("")
  })
})
