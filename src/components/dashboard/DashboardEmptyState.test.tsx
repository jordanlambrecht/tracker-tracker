// src/components/dashboard/DashboardEmptyState.test.tsx
//
// The sidebar's "+ Add Tracker" keeps its dialog state local and the two components are
// siblings under AuthShell, so this empty state has to own its own dialog. The wiring worth
// pinning is what happens after a tracker is created: the dialog closes, the dashboard
// refetches, and we navigate to the new tracker, the same three steps the sidebar does.
//
// The dashboard shows this whenever no tracker is active, so it also covers an account whose
// trackers are all archived. Those rows still hold their slugs, which the dialog must get.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const dialog = vi.hoisted(() => ({
  heldSlugs: undefined as ReadonlyMap<string, boolean> | undefined,
}))

vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: ({
    open,
    onAdded,
    heldSlugs,
  }: {
    open: boolean
    onAdded: (trackerId: number) => void
    heldSlugs: ReadonlyMap<string, boolean>
  }) => {
    dialog.heldSlugs = heldSlugs
    return open ? (
      <div data-testid="add-tracker-dialog">
        <button type="button" onClick={() => onAdded(7)}>
          simulate tracker created
        </button>
      </div>
    ) : null
  },
}))

import { DashboardEmptyState } from "./DashboardEmptyState"

function row(id: number, registrySlug: string | null) {
  return { id, registrySlug, isActive: false } as unknown as TrackerSummary
}

function renderEmptyState(rows: TrackerSummary[], onAdded = vi.fn()) {
  // Never stale, so the component reads the cached rows without fetching.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  })
  queryClient.setQueryData(trackerQueryOptions.queryKey, rows)
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardEmptyState onAdded={onAdded} />
    </QueryClientProvider>
  )
}

describe("DashboardEmptyState", () => {
  it("explains the empty dashboard with a real heading", () => {
    renderEmptyState([])

    expect(screen.getByRole("heading", { name: "No trackers added yet" })).toBeInTheDocument()
    expect(screen.getByText(/start recording ratio, buffer, and rank/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add First Tracker" })).toBeInTheDocument()
  })

  it("opens its own add-tracker dialog from the Add First Tracker button", async () => {
    const user = userEvent.setup()
    renderEmptyState([])

    expect(screen.queryByTestId("add-tracker-dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add First Tracker" }))

    expect(screen.getByTestId("add-tracker-dialog")).toBeInTheDocument()
  })

  it("closes, refreshes, and navigates to the tracker once one is added", async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    renderEmptyState([], onAdded)

    await user.click(screen.getByRole("button", { name: "Add First Tracker" }))
    await user.click(screen.getByRole("button", { name: "simulate tracker created" }))

    expect(screen.queryByTestId("add-tracker-dialog")).not.toBeInTheDocument()
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/trackers/7")
  })

  // A row the tracker list doesn't carry has no slug, and it still counts.
  it.each([
    ["a listed tracker", row(1, "aither")],
    ["a tracker the list doesn't carry", row(1, null)],
  ])("says every tracker is archived when its one archived row is on %s", (_on, archived) => {
    renderEmptyState([archived])

    expect(
      screen.getByRole("heading", { name: "All your trackers are archived" })
    ).toBeInTheDocument()
    expect(screen.getByText(/Find them under Show Archived in the sidebar/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Tracker" })).toBeInTheDocument()
    expect(screen.queryByText("No trackers added yet")).toBeNull()
  })

  it("hands the dialog the slugs its archived trackers hold", async () => {
    const user = userEvent.setup()
    renderEmptyState([row(1, "aither"), row(2, null)])

    await user.click(screen.getByRole("button", { name: "Add Tracker" }))

    expect(dialog.heldSlugs).toEqual(new Map([["aither", false]]))
  })
})
