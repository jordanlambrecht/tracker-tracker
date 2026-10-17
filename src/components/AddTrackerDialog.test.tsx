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

function testConnectionRequest() {
  return fetchMock.mock.calls.find(([url]) => String(url) === "/api/trackers/test-connection")
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
    // Cancelling must clear both secrets, or a reopened dialog shows them again.
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

async function pickRetroToon(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Search trackers..."), "RetroToon")
  await user.keyboard("{Enter}")
}

describe("AddTrackerDialog retrotoon credentials", () => {
  it("stores the browser User-Agent alongside the session cookies", async () => {
    // RetroToon fingerprints the session against the UA that minted the
    // cookies, so the blob must carry this browser's UA, not a server default.
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickRetroToon(user)
    await user.type(screen.getByLabelText("Browser Cookies"), "PHPSESSID=abc123")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const blob = JSON.parse(JSON.parse(String(createRequest()?.[1]?.body)).apiToken)
    expect(blob).toEqual({ cookies: "PHPSESSID=abc123", userAgent: navigator.userAgent })
  })

  it("strips a copied 'Cookie: ' prefix before storing", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickRetroToon(user)
    await user.type(screen.getByLabelText("Browser Cookies"), "Cookie: PHPSESSID=abc123")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const blob = JSON.parse(JSON.parse(String(createRequest()?.[1]?.body)).apiToken)
    expect(blob.cookies).toBe("PHPSESSID=abc123")
  })

  it("clears the pasted cookies when the dialog is cancelled", async () => {
    // Cancelling must clear the pasted cookie, or a reopened dialog shows the
    // session cookie again.
    const user = userEvent.setup()
    const { rerender } = render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickRetroToon(user)
    await user.type(screen.getByLabelText("Browser Cookies"), "PHPSESSID=abc123")
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    rerender(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)
    await pickRetroToon(user)
    expect(screen.getByLabelText("Browser Cookies")).toHaveValue("")
  })
})

/** One input event per value: typing re-filters the registry list on every keystroke. */
async function paste(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

/** Undoes any current pick first; the search box shows that pick's name as its placeholder. */
async function pickPreset(user: ReturnType<typeof userEvent.setup>, name: string) {
  const clear = screen.queryByRole("button", { name: "Clear selection" })
  if (clear) await user.click(clear)
  await paste(user, screen.getByPlaceholderText("Search trackers..."), name)
  await user.keyboard("{Enter}")
}

describe("AddTrackerDialog Mousehole fields", () => {
  it("clears the Mousehole URL and token when the tracker is switched", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickPreset(user, "MyAnonaMouse")
    await paste(user, screen.getByLabelText("Mousehole URL (optional)"), "http://mh:5010")
    await paste(user, screen.getByLabelText("Mousehole API token"), "tok-7f3a")

    await pickPreset(user, "TorrentLeech")
    await pickPreset(user, "MyAnonaMouse")

    expect(screen.getByLabelText("Mousehole URL (optional)")).toHaveValue("")
    expect(screen.getByLabelText("Mousehole API token")).toHaveValue("")
  })

  it("sends the Mousehole URL and token when adding MAM", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickPreset(user, "MyAnonaMouse")
    await paste(user, screen.getByLabelText("API Token"), "not-a-real-mam-cookie")
    await paste(user, screen.getByLabelText("Mousehole URL (optional)"), "http://mh:5010")
    await paste(user, screen.getByLabelText("Mousehole API token"), "tok-7f3a")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const saved = JSON.parse(String(createRequest()?.[1]?.body))
    expect(saved).toMatchObject({
      slug: "myanonamouse",
      mouseholeUrl: "http://mh:5010",
      mouseholeToken: "tok-7f3a",
    })
  })
})

describe("AddTrackerDialog request bodies", () => {
  it("names the tracker by slug and sends no URL or platform to either route", async () => {
    // The address is registry data keyed by the slug, so a URL in either body
    // would be a second opinion about where the tracker lives.
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pickTorrentLeech(user)
    await user.type(screen.getByLabelText("TorrentLeech Username"), "bob")
    await user.type(screen.getByLabelText("TorrentLeech Password"), "hunter2")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    const tested = JSON.parse(String(testConnectionRequest()?.[1]?.body))
    expect(tested.slug).toBe("torrentleech")
    expect(tested).not.toHaveProperty("baseUrl")
    expect(tested).not.toHaveProperty("platformType")

    const saved = JSON.parse(String(createRequest()?.[1]?.body))
    expect(saved.slug).toBe("torrentleech")
    expect(saved).not.toHaveProperty("baseUrl")
    expect(saved).not.toHaveProperty("platformType")
  })
})
