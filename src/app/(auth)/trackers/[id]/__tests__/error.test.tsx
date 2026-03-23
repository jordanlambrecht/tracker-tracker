// src/app/(auth)/trackers/[id]/__tests__/error.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import TrackerDetailError from "@/app/(auth)/trackers/[id]/error"

describe("TrackerDetail error boundary", () => {
  it("renders the error message", () => {
    const error = Object.assign(new Error("Tracker data failed to load"), { digest: "abc" })
    render(<TrackerDetailError error={error} reset={vi.fn()} />)
    expect(screen.getByText(/Tracker data failed to load/i)).toBeInTheDocument()
  })

  it("calls reset when Try Again is clicked", async () => {
    const reset = vi.fn()
    render(<TrackerDetailError error={new Error("fail")} reset={reset} />)
    await userEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it("provides a Go Home link to the dashboard", () => {
    render(<TrackerDetailError error={new Error("fail")} reset={vi.fn()} />)
    const link = screen.getByRole("link", { name: /go home/i })
    expect(link).toHaveAttribute("href", "/")
  })

  it("renders safely when error.message is empty", () => {
    expect(() => render(<TrackerDetailError error={new Error("")} reset={vi.fn()} />)).not.toThrow()
  })
})
