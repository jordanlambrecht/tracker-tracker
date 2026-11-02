// src/components/ui/__tests__/ConfirmRemove.test.tsx
//
// disabled stands for another action on the same row, such as an archive. It
// holds the first button and the confirm step alike, so a delete can neither
// start nor be confirmed while that action runs.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConfirmRemove } from "@/components/ui/ConfirmRemove"

describe("ConfirmRemove", () => {
  it("can't be started while another action runs", () => {
    render(<ConfirmRemove label="Delete" onConfirm={vi.fn()} disabled />)

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })

  it("can't be confirmed once another action starts", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const props = { label: "Delete", confirmLabel: "Confirm Delete", onConfirm }
    const { rerender } = render(<ConfirmRemove {...props} />)

    await user.click(screen.getByRole("button", { name: "Delete" }))
    rerender(<ConfirmRemove {...props} disabled />)

    expect(screen.getByRole("button", { name: "Confirm Delete" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })
})
