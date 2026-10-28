// src/components/tracker-detail/__tests__/TrackerCaptchaPrompt.test.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrackerCaptchaPrompt } from "@/components/tracker-detail/TrackerCaptchaPrompt"
import type { TrackerSummary } from "@/types/api"

const CAPTCHA_ERROR = "Enter the RuTracker captcha on the tracker page"

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 7,
    name: "RuTracker",
    platformType: "rutracker",
    lastError: CAPTCHA_ERROR,
    ...overrides,
  } as unknown as TrackerSummary
}

const fetchMock = vi.fn()

function renderPrompt(tracker: TrackerSummary, onSolved = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <TrackerCaptchaPrompt tracker={tracker} onSolved={onSolved} />
    </QueryClientProvider>
  )
  return onSolved
}

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

describe("TrackerCaptchaPrompt", () => {
  it("makes no request while the last poll did not fail on a captcha", () => {
    renderPrompt(makeTracker({ lastError: "Session expired" }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the captcha and submits the answer", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/trackers/7/captcha" && init?.method === "POST") {
        return json({ success: true, polled: true })
      }
      if (url === "/api/trackers/7/captcha") {
        return json({ pending: true, image: "data:image/jpeg;base64,AQID", expiresAt: "x" })
      }
      return json(makeTracker({ lastError: null }))
    })
    const onSolved = renderPrompt(makeTracker())

    expect(await screen.findByAltText("Captcha")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Captcha"), "x7k2")
    await userEvent.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() => expect(onSolved).toHaveBeenCalled())
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ answer: "x7k2" })
  })

  it("shows the error for a rejected answer", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json({ error: "Wrong captcha, try the new one" }, 422)
        : json({ pending: true, image: "data:image/jpeg;base64,AQID", expiresAt: "x" })
    )
    renderPrompt(makeTracker())

    await userEvent.type(await screen.findByLabelText("Captcha"), "nope")
    await userEvent.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText("Wrong captcha, try the new one")).toBeInTheDocument()
  })
})
