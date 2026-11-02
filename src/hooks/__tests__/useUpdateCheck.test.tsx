// src/hooks/__tests__/useUpdateCheck.test.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OutboundProvider } from "@/components/layout/OutboundProvider"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"

function renderUpdateCheck(outboundDisabled: boolean) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <OutboundProvider disabled={outboundDisabled}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OutboundProvider>
  )
  return renderHook(() => useUpdateCheck(), { wrapper })
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ tag_name: "v99.0.0" }), { status: 200 }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useUpdateCheck", () => {
  it("asks GitHub for the latest release when outbound requests are allowed", async () => {
    const { result } = renderUpdateCheck(false)
    await waitFor(() => expect(result.current.latestVersion).toBe("99.0.0"))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("never asks GitHub when outbound requests are off", async () => {
    const { result } = renderUpdateCheck(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetch).not.toHaveBeenCalled()
    expect(result.current).toEqual({ latestVersion: null, updateAvailable: false, loading: false })
  })
})
