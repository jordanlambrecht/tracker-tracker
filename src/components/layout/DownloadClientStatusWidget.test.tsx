// src/components/layout/DownloadClientStatusWidget.test.tsx
//
// errorSince is the heartbeat's outage clock. A lastError without it is a
// deep-poll failure on a client that still answers, and the sidebar must not
// call that client down.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { DownloadClientStatusWidget } from "@/components/layout/DownloadClientStatusWidget"
import type { SafeDownloadClient } from "@/types/api"

// MarqueeText builds a ResizeObserver in an effect and jsdom has none. Nothing
// here depends on it firing.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

function client(overrides: Partial<SafeDownloadClient> = {}): SafeDownloadClient {
  return {
    id: 1,
    name: "Seedbox",
    type: "qbittorrent",
    enabled: true,
    host: "localhost",
    port: 8080,
    useSsl: false,
    authMethod: "password",
    hasCredentials: true,
    hasUrlPath: false,
    pollIntervalSeconds: 300,
    isDefault: false,
    crossSeedTags: [],
    lastPolledAt: "2026-10-28T00:00:00.000Z",
    lastError: null,
    errorSince: null,
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T00:00:00.000Z",
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

function renderWidget(row: SafeDownloadClient) {
  fetchMock.mockImplementation(async (url: string) =>
    url === "/api/clients" ? new Response(JSON.stringify([row])) : new Response("[]")
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DownloadClientStatusWidget />
    </QueryClientProvider>
  )
}

describe("DownloadClientStatusWidget client state", () => {
  it("shows a deep-poll failure as paused stats, not as down", async () => {
    const lastError = "Request timed out"
    const { container } = renderWidget(client({ lastError, errorSince: null }))

    const status = await screen.findByText("Stats paused")
    expect(status).toHaveAttribute("title", lastError)
    expect(status).toHaveClass("text-warn")
    expect(screen.queryByText(/^Down/)).toBeNull()
    expect(container.querySelector(".color-dot")).toHaveClass("bg-warn")
  })

  it("shows a heartbeat outage as down", async () => {
    const { container } = renderWidget(
      client({ lastError: "Connection refused", errorSince: "2026-10-28T00:00:00.000Z" })
    )

    const status = await screen.findByText(/^Down /)
    expect(status).toHaveClass("text-danger")
    expect(screen.queryByText("Stats paused")).toBeNull()
    expect(container.querySelector(".color-dot")).toHaveClass("bg-danger")
  })
})
