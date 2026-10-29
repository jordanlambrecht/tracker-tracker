// src/components/__tests__/TrackerHubStatus.test.tsx

import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TrackerHubStatus } from "@/components/TrackerHubStatus"

const ENTRY = {
  slug: "example",
  status: "up",
  uptime: "99.90%",
  uptimeDay: "100.00%",
  uptimeWeek: "99.50%",
  uptimeMonth: "99.80%",
  uptimeYear: "99.70%",
  time: 400,
  timeDay: 512,
  timeWeek: 1500,
  timeMonth: 480,
  timeYear: 470,
}

function mockSummary(entry: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify([entry]), { status: 200 }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TrackerHubStatus", () => {
  it("lays out uptime and response time by window in a grid", async () => {
    mockSummary(ENTRY)
    render(<TrackerHubStatus trackerHubSlug="example" />)

    expect(await screen.findByText("Up")).toBeInTheDocument()
    for (const text of ["24h", "7d", "30d", "1y", "Uptime", "Response"]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    for (const text of ["100.00%", "99.50%", "99.80%", "99.70%", "512 ms", "1.5 s", "480 ms"]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it("shows a dash for windows an older summary does not have", async () => {
    const { uptimeYear: _u, timeWeek: _w, timeMonth: _m, timeYear: _y, ...older } = ENTRY
    mockSummary(older)
    render(<TrackerHubStatus trackerHubSlug="example" />)

    const grid = (await screen.findByText("Uptime")).parentElement as HTMLElement
    expect(within(grid).getAllByText("—")).toHaveLength(4)
  })
})
