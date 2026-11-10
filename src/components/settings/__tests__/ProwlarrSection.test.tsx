// src/components/settings/__tests__/ProwlarrSection.test.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { awaitingFirstPoll, ProwlarrSection } from "@/components/settings/ProwlarrSection"
import type { SafeProwlarrInstance } from "@/types/api"

function instance(overrides: Partial<SafeProwlarrInstance> = {}): SafeProwlarrInstance {
  return {
    id: 3,
    name: "Home Prowlarr",
    url: "http://prowlarr.test:9696",
    publicUrl: null,
    hasApiKey: true,
    enabled: true,
    indexerCount: 2,
    lastPolledAt: "2026-08-14T12:00:00.000Z",
    indexersReadAt: "2026-08-14T12:00:00.000Z",
    statsReadAt: "2026-08-14T12:00:00.000Z",
    lastError: null,
    errorSince: null,
    version: "1.2.3",
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
    ...overrides,
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ProwlarrSection />
    </QueryClientProvider>
  )
}

describe("ProwlarrSection", () => {
  it("keeps an instance and says so when removing it fails", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? new Response(JSON.stringify({ error: "Failed to delete Prowlarr instance" }), {
            status: 500,
          })
        : new Response(JSON.stringify([instance()]))
    )
    renderSection()

    await user.click(await screen.findByText("Home Prowlarr"))
    await user.click(screen.getByRole("button", { name: "Remove" }))
    await user.click(screen.getByRole("button", { name: "Confirm Remove" }))

    expect(await screen.findByText("Failed to delete Prowlarr instance")).toBeInTheDocument()
    expect(screen.getByText("Home Prowlarr")).toBeInTheDocument()
  })

  it("removes an instance once its row is deleted", async () => {
    const user = userEvent.setup()
    let deleted = false
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deleted = true
        return new Response(JSON.stringify({ success: true }))
      }
      return new Response(JSON.stringify(deleted ? [] : [instance()]))
    })
    renderSection()

    await user.click(await screen.findByText("Home Prowlarr"))
    await user.click(screen.getByRole("button", { name: "Remove" }))
    await user.click(screen.getByRole("button", { name: "Confirm Remove" }))

    await vi.waitFor(() => expect(screen.queryByText("Home Prowlarr")).not.toBeInTheDocument())
  })
})

describe("awaitingFirstPoll", () => {
  it("polls only until a new instance's first poll finishes or fails", () => {
    expect(awaitingFirstPoll(undefined)).toBe(false)
    expect(awaitingFirstPoll([instance()])).toBe(false)
    expect(awaitingFirstPoll([instance(), instance({ id: 4, lastPolledAt: null })])).toBe(true)
    expect(awaitingFirstPoll([instance({ lastPolledAt: null, lastError: "Refused" })])).toBe(false)
    expect(awaitingFirstPoll([instance({ lastPolledAt: null, enabled: false })])).toBe(false)
  })
})
