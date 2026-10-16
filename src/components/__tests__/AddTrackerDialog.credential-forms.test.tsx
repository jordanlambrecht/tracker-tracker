// src/components/__tests__/AddTrackerDialog.credential-forms.test.tsx
//
// Join Date visibility and the cookie-paste messages come from the credential
// table; these pin what the user sees in the dialog.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AddTrackerDialog } from "@/components/AddTrackerDialog"

const fetchMock = vi.fn()

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: unknown) => {
    const target = String(url)
    if (target === "/api/trackers/test-connection") {
      return jsonResponse({ username: "someone", group: "User" })
    }
    if (target === "/api/trackers") return jsonResponse({ id: 1 })
    return jsonResponse({})
  })
  vi.stubGlobal("fetch", fetchMock)
})

/**
 * Picks a preset by its exact registry name. Clicking the option beats typing
 * and pressing Enter: the combobox filters on a fuzzy subsequence match, so the
 * first hit for a short query is not always the tracker meant here.
 */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByPlaceholderText("Search trackers..."), name)
  await user.click(
    screen.getByRole("option", { name: (accessible) => accessible.startsWith(name) })
  )
}

const JOIN_DATE = "Join Date (optional)"

describe("AddTrackerDialog preset switch", () => {
  it("drops a pasted API token when the preset changes so it never reaches another host", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, "Aither")
    await user.type(screen.getByLabelText("API Token"), "tok123")
    await user.click(screen.getByRole("button", { name: "Clear selection" }))
    await pick(user, "Blutopia")

    expect(screen.getByLabelText("API Token")).toHaveValue("")
  })

  it("drops pasted cookies when the preset changes", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, "FileList")
    await user.type(screen.getByLabelText("Browser Cookies"), "uid=1; pass=abc")
    await user.click(screen.getByRole("button", { name: "Clear selection" }))
    await pick(user, "RetroToon World")

    expect(screen.getByLabelText("Browser Cookies")).toHaveValue("")
  })
})

describe("AddTrackerDialog join date visibility", () => {
  // Every platform that reports its own join date, plus a Gazelle tracker with
  // enrichment turned on, which is a per-tracker fact rather than a platform one.
  const HIDDEN = [
    ["avistaz", "AvistaZ"],
    ["digitalcore", "DigitalCore.Club"],
    ["filelist", "FileList"],
    ["retrotoon", "RetroToon World"],
    ["ggn", "GazelleGames"],
    ["gazelle with enrichment", "Orpheus"],
  ] as const

  it.each(HIDDEN)("hides it for %s", async (_platform, trackerName) => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, trackerName)

    expect(screen.queryByLabelText(JOIN_DATE)).not.toBeInTheDocument()
  })

  const SHOWN = [
    ["iptorrents", "IPTorrents"],
    ["hawke", "HAWKE-UNO"],
  ] as const

  it.each(SHOWN)("shows it for %s", async (_platform, trackerName) => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, trackerName)

    expect(screen.getByLabelText(JOIN_DATE)).toBeInTheDocument()
  })

  it("offers no join date before a tracker is chosen", () => {
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)
    expect(screen.queryByLabelText(JOIN_DATE)).not.toBeInTheDocument()
  })
})

describe("AddTrackerDialog cookie paste errors", () => {
  it("says a bare cookie name is a name, not a malformed cookie string", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, "RetroToon World")
    await user.type(screen.getByLabelText("Browser Cookies"), "PHPSESSID")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    expect(await screen.findByText(/you pasted a cookie name \("PHPSESSID"\)/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("quotes the tracker's own cookie example when there is no key=value pair", async () => {
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, "RetroToon World")
    await user.type(screen.getByLabelText("Browser Cookies"), "justastring")
    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    expect(await screen.findByText(/PHPSESSID=abc123def456/)).toBeInTheDocument()
  })

  it("names the tracker in the AvistaZ network username label", async () => {
    // One platform, several sites. The label has to say which site's account
    // the username belongs to.
    const user = userEvent.setup()
    render(<AddTrackerDialog open onClose={vi.fn()} onAdded={vi.fn()} />)

    await pick(user, "CinemaZ")

    expect(screen.getByLabelText("CinemaZ Username")).toBeInTheDocument()
  })
})
