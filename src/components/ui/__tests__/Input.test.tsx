// src/components/ui/__tests__/Input.test.tsx
//
// The tooltip prop exists so credential fields stop hand-rolling label rows:
// before it, any field needing an info icon abandoned the built-in label and
// copied the row markup, which reached eight drifting copies.

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AreaInput } from "@/components/ui/AreaInput"
import { Input } from "@/components/ui/Input"

describe("Input tooltip", () => {
  it("renders an info tip beside the label", () => {
    render(<Input label="Password" tooltip="Stored encrypted." />)
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "More info" })).toBeInTheDocument()
  })

  it("keeps the tip outside the label element so clicking it never focuses the field", () => {
    render(<Input label="Password" tooltip="Stored encrypted." />)
    const label = screen.getByText("Password").closest("label")
    const tip = screen.getByRole("button", { name: "More info" })
    expect(label).not.toBeNull()
    expect(label?.contains(tip)).toBe(false)
  })

  it("renders no tip when the prop is absent", () => {
    render(<Input label="Password" />)
    expect(screen.queryByRole("button", { name: "More info" })).toBeNull()
  })
})

describe("AreaInput tooltip", () => {
  it("renders an info tip beside the label, outside the label element", () => {
    render(<AreaInput label="Browser Cookies" tooltip="Copy the Cookie header." />)
    const label = screen.getByText("Browser Cookies").closest("label")
    const tip = screen.getByRole("button", { name: "More info" })
    expect(screen.getByLabelText("Browser Cookies")).toBeInTheDocument()
    expect(label?.contains(tip)).toBe(false)
  })

  it("renders no tip when the prop is absent", () => {
    render(<AreaInput label="Browser Cookies" />)
    expect(screen.queryByRole("button", { name: "More info" })).toBeNull()
  })
})
