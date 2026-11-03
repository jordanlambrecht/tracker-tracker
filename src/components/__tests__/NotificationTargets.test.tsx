// src/components/__tests__/NotificationTargets.test.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotificationTargets } from "@/components/NotificationTargets"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response("[]"))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("NotificationTargets", () => {
  // The other settings sections are regions named by their heading, so a screen
  // reader can jump to Webhooks the same way.
  it("is a region named by its Webhooks heading", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationTargets />
      </QueryClientProvider>
    )

    expect(await screen.findByRole("region", { name: "Webhooks" })).toBeInTheDocument()
  })
})
