// src/components/dashboard/__tests__/FleetDashboard.test.tsx
//
// Regression tests for the Torrent Fleet tab's day-range plumbing.
//
// FleetDashboard is a SECOND, independent fetch site for the dashboard day range
// (the first is useDashboardData). It used to rewrite the "All" sentinel with
// `const effectiveDays = dayRange === 0 ? 30 : dayRange`, capping the whole tab at
// 30 days of history no matter what the sidebar said.
//
// These assert only the request that leaves the component. The component returns a
// loading skeleton while aggregation is pending and snapshots are empty, so no
// chart ever renders here and echarts is never exercised.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FleetDashboard } from "@/components/dashboard/FleetDashboard"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

let fetchMock: ReturnType<typeof vi.fn>

/** All fleet-snapshot URLs requested so far, in call order. */
function fleetSnapshotUrls(): string[] {
  return (fetchMock.mock.calls as unknown[][])
    .map((args) => String(args[0]))
    .filter((u) => u.startsWith("/api/fleet/snapshots"))
}

beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  )
  global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("FleetDashboard day range plumbing", () => {
  it("requests days=0 when dayRange is 0 (All)", async () => {
    render(<FleetDashboard dayRange={0} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fleetSnapshotUrls()).toContain("/api/fleet/snapshots?days=0")
    })

    // The pre-fix behaviour substituted 30 for the All sentinel.
    expect(fleetSnapshotUrls()).not.toContain("/api/fleet/snapshots?days=30")
  })

  it("passes a bounded range through unchanged", async () => {
    render(<FleetDashboard dayRange={7} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fleetSnapshotUrls()).toContain("/api/fleet/snapshots?days=7")
    })
  })

  it("does not fetch fleet snapshots while the tab is inactive", async () => {
    render(<FleetDashboard dayRange={0} isActive={false} />, { wrapper: createWrapper() })

    // /api/clients is not gated by isActive, so it is a deterministic sync point
    // proving the component mounted and its queries ran.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/clients", expect.any(Object))
    })
    expect(fleetSnapshotUrls()).toHaveLength(0)
  })
})
