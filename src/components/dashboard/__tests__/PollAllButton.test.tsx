// src/components/dashboard/__tests__/PollAllButton.test.tsx
//
// The button reads Poll All's NDJSON answer line by line. A last line with no
// newline still counts, and an answer with nothing to poll says so instead of
// claiming that every tracker polled.

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PollAllButton } from "@/components/dashboard/PollAllButton"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

function answer(body: string) {
  fetchMock.mockResolvedValue(
    new Response(body, { headers: { "Content-Type": "application/x-ndjson" } })
  )
}

// Every label is always rendered; only the current one is opaque.
function showing(label: string) {
  return screen.getByText(label).className.includes("opacity-100")
}

async function pollAll() {
  const onPollComplete = vi.fn()
  render(<PollAllButton onPollComplete={onPollComplete} />)
  await userEvent.setup().click(screen.getByRole("button"))
  await waitFor(() => expect(onPollComplete).toHaveBeenCalled())
}

describe("PollAllButton", () => {
  it("says there is nothing to poll when the route polls nothing", async () => {
    answer(`${JSON.stringify({ total: 0, done: true, polled: 0, failed: 0 })}\n`)

    await pollAll()

    await waitFor(() => expect(showing("Nothing to Poll")).toBe(true))
    expect(showing("✓ All Polled")).toBe(false)
  })

  it("reads a last line that has no newline", async () => {
    answer(
      `${JSON.stringify({ total: 1 })}\n${JSON.stringify({ done: true, polled: 0, failed: 1 })}`
    )

    await pollAll()

    await waitFor(() => expect(showing("✕ Some Failed")).toBe(true))
  })

  it("says all polled after a clean run", async () => {
    answer(
      [{ total: 1 }, { trackerId: 4, ok: true }, { done: true, polled: 1, failed: 0 }]
        .map((line) => `${JSON.stringify(line)}\n`)
        .join("")
    )

    await pollAll()

    await waitFor(() => expect(showing("✓ All Polled")).toBe(true))
  })
})
