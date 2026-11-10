// src/components/tracker-detail/platform/__tests__/MamMouseholeCard.test.tsx
//
// The card's failure paths. A refusal from Mousehole must be readable while
// the card is collapsed, a failure after the first load must show rather than
// leave the last status standing alone, and the link must never carry a token.

import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MamMouseholeCard } from "@/components/tracker-detail/platform/MamMouseholeCard"
import type { MouseholeStatusResponse } from "@/lib/mousehole"

const STATUS_OK: MouseholeStatusResponse = {
  result: "ok",
  hasCookie: true,
  ip: "203.0.113.7",
  asn: 64496,
  asOrg: "Example Transit",
  nextContactAt: null,
  lastContactAt: null,
  lastMessage: "No change",
  stateError: null,
}

const TOKEN_MISSING =
  "Mousehole needs an API token. Set MOUSEHOLE_AUTH_TOKEN on Mousehole (a password alone is never accepted by its API) and enter it in this tracker's settings"

const fetchMock = vi.fn()

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("MamMouseholeCard", () => {
  it("shows a refused /state outside the collapsible section while collapsed", async () => {
    localStorage.setItem("tracker-tracker:mousehole-expanded", "false")
    fetchMock.mockResolvedValue(
      jsonResponse({ ...STATUS_OK, result: "no-cookie", stateError: TOKEN_MISSING })
    )

    render(<MamMouseholeCard trackerId={1} mouseholeUrl="http://mousehole-test:5010" />)

    const notice = await screen.findByText(TOKEN_MISSING)
    // The collapsed section is the max-h-0 container. The notice must not sit
    // inside it, or a collapsed card shows only the /health label.
    expect(document.querySelector(".max-h-0")).not.toBeNull()
    expect(notice.closest(".max-h-0")).toBeNull()
    expect(screen.getByText("No cookie")).toBeInTheDocument()
  })

  it("shows a Check Now failure after data has loaded, keeping the last status", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(STATUS_OK))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Mousehole unreachable" }, { ok: false, status: 502 })
      )

    render(<MamMouseholeCard trackerId={1} mouseholeUrl="http://mousehole-test:5010" />)

    await screen.findByText("OK")
    await userEvent.click(screen.getByRole("button", { name: "Check Now" }))

    expect(await screen.findByText("Mousehole unreachable")).toBeInTheDocument()
    expect(screen.getByText("OK")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/trackers/1/mousehole", { method: "POST" })
  })

  it("greys the status while polls fail and restores it on the next good poll", async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(STATUS_OK))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Mousehole unreachable" }, { ok: false, status: 502 })
      )
      .mockResolvedValue(jsonResponse(STATUS_OK))

    render(<MamMouseholeCard trackerId={1} mouseholeUrl="http://mousehole-test:5010" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const dot = () => screen.getByText("OK").previousElementSibling
    expect(dot()).toHaveClass("animate-pulse-glow")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(screen.getByText("Mousehole unreachable")).toBeInTheDocument()
    expect(dot()).toHaveClass("bg-muted")
    expect(dot()).not.toHaveClass("animate-pulse-glow")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(screen.queryByText("Mousehole unreachable")).not.toBeInTheDocument()
    expect(dot()).toHaveClass("animate-pulse-glow")
  })

  it("links to the URL without any userinfo it still carries", async () => {
    fetchMock.mockResolvedValue(jsonResponse(STATUS_OK))

    render(
      <MamMouseholeCard trackerId={1} mouseholeUrl="http://:fake-token-7f3a@mousehole-test:5010" />
    )

    await screen.findByText("OK")
    const link = screen.getByRole("link", { name: /mousehole/i })
    expect(link).toHaveAttribute("href", "http://mousehole-test:5010")
  })

  it("links to the public URL when one is set", async () => {
    fetchMock.mockResolvedValue(jsonResponse(STATUS_OK))

    render(
      <MamMouseholeCard
        trackerId={1}
        mouseholeUrl="http://mousehole-test:5010"
        mouseholePublicUrl="https://mousehole.example.com/"
      />
    )

    await screen.findByText("OK")
    const link = screen.getByRole("link", { name: /mousehole/i })
    expect(link).toHaveAttribute("href", "https://mousehole.example.com")
  })
})
