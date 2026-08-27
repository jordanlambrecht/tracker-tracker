// src/components/AddTrackerDialog.test.tsx
//
// DigitalCore's session cookies are copied out of a browser, so the credential
// blob carries that browser's User-Agent. Both writers have to capture it. The
// stored blob never comes back to the client, so TrackerSettingsSheet cannot
// preserve a value this dialog failed to store, and a later cookie change would
// silently revert the tracker to the app default.
// TrackerSettingsSheet.test.tsx guards the other half.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AddTrackerDialog } from "./AddTrackerDialog"

const fetchMock = vi.fn()

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

/** The POST that creates the tracker, which is the one carrying the blob. */
function createRequest() {
  return fetchMock.mock.calls.find(
    ([url, init]) => String(url) === "/api/trackers" && init?.method === "POST"
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: unknown) => {
    const target = String(url)
    if (target === "/api/trackers/test-connection") {
      return jsonResponse({ username: "dcuser", group: "Viceroy" })
    }
    if (target === "/api/trackers") return jsonResponse({ id: 99 })
    return jsonResponse({})
  })
  vi.stubGlobal("fetch", fetchMock)
})

async function pickDigitalCore(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Search trackers..."), "DigitalCore")
  await user.keyboard("{Enter}")
}

describe("AddTrackerDialog digitalcore credentials", () => {
  it("stores the browser User-Agent alongside the session cookies", async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={onAdded} />)

    await pickDigitalCore(user)
    await user.type(screen.getByLabelText("Session Cookies"), "uid=56954; pass=abc123def456")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const request = createRequest()
    expect(request).toBeDefined()
    const blob = JSON.parse(JSON.parse(String(request?.[1]?.body)).apiToken)
    expect(blob.uid).toBe("56954")
    expect(blob.pass).toBe("abc123def456")
    expect(blob.userAgent).toBe(navigator.userAgent)
  })

  it("sends the same blob to test-connection before saving", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickDigitalCore(user)
    await user.type(screen.getByLabelText("Session Cookies"), "uid=56954; pass=abc123def456")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const test = fetchMock.mock.calls.find(
      ([url]) => String(url) === "/api/trackers/test-connection"
    )
    const blob = JSON.parse(JSON.parse(String(test?.[1]?.body)).apiToken)
    expect(blob.userAgent).toBe(navigator.userAgent)
  })
})

async function pickTorrentLeech(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Search trackers..."), "TorrentLeech")
  await user.keyboard("{Enter}")
}

describe("AddTrackerDialog torrentleech credentials", () => {
  it("includes the Alt 2FA Token in the blob only when one is entered", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickTorrentLeech(user)
    await user.type(screen.getByLabelText("TorrentLeech Username"), "bob")
    await user.type(screen.getByLabelText("TorrentLeech Password"), "hunter2")
    await user.type(screen.getByLabelText("Alt 2FA Token (optional)"), "tok123")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const request = createRequest()
    expect(request).toBeDefined()
    const blob = JSON.parse(JSON.parse(String(request?.[1]?.body)).apiToken)
    expect(blob).toEqual({ username: "bob", password: "hunter2", alt2FAToken: "tok123" })
  })

  it("omits the token key entirely for accounts without 2FA", async () => {
    // The stored blob must stay byte-compatible with what non-2FA accounts
    // have always had, so the key is absent, not empty.
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickTorrentLeech(user)
    await user.type(screen.getByLabelText("TorrentLeech Username"), "bob")
    await user.type(screen.getByLabelText("TorrentLeech Password"), "hunter2")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const blob = JSON.parse(JSON.parse(String(createRequest()?.[1]?.body)).apiToken)
    expect(blob).toEqual({ username: "bob", password: "hunter2" })
    expect("alt2FAToken" in blob).toBe(false)
  })

  it("clears the typed credentials when the dialog is cancelled", async () => {
    // Closing used to keep the password (and now a second secret) in component
    // state and re-show both on reopen.
    const user = userEvent.setup()
    const { rerender } = render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickTorrentLeech(user)
    await user.type(screen.getByLabelText("TorrentLeech Password"), "hunter2")
    await user.type(screen.getByLabelText("Alt 2FA Token (optional)"), "tok123")
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    rerender(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)
    await pickTorrentLeech(user)
    expect(screen.getByLabelText("TorrentLeech Password")).toHaveValue("")
    expect(screen.getByLabelText("Alt 2FA Token (optional)")).toHaveValue("")
  })
})
