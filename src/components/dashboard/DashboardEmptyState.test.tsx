// src/components/dashboard/DashboardEmptyState.test.tsx
//
// The sidebar's "+ Add Tracker" keeps its dialog state local and the two components are
// siblings under AuthShell, so this empty state has to own its own dialog. The wiring worth
// pinning is what happens after a tracker is created: the dialog closes, the dashboard
// refetches, and we navigate to the new tracker — the same three steps the sidebar does.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: ({
    open,
    onAdded,
  }: {
    open: boolean
    onAdded: (trackerId: number) => void
  }) =>
    open ? (
      <div data-testid="add-tracker-dialog">
        <button type="button" onClick={() => onAdded(7)}>
          simulate tracker created
        </button>
      </div>
    ) : null,
}))

import { DashboardEmptyState } from "./DashboardEmptyState"

describe("DashboardEmptyState", () => {
  it("explains the empty dashboard with a real heading", () => {
    render(<DashboardEmptyState onAdded={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "No trackers added yet" })).toBeInTheDocument()
    expect(screen.getByText(/start recording ratio, buffer, and rank/i)).toBeInTheDocument()
  })

  it("opens its own add-tracker dialog from the Add First Tracker button", async () => {
    const user = userEvent.setup()
    render(<DashboardEmptyState onAdded={vi.fn()} />)

    expect(screen.queryByTestId("add-tracker-dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add First Tracker" }))

    expect(screen.getByTestId("add-tracker-dialog")).toBeInTheDocument()
  })

  it("closes, refreshes, and navigates to the tracker once one is added", async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    render(<DashboardEmptyState onAdded={onAdded} />)

    await user.click(screen.getByRole("button", { name: "Add First Tracker" }))
    await user.click(screen.getByRole("button", { name: "simulate tracker created" }))

    expect(screen.queryByTestId("add-tracker-dialog")).not.toBeInTheDocument()
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/trackers/7")
  })
})
