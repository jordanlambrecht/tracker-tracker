// src/components/ui/__tests__/Input.ref.test.tsx

import { render } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it } from "vitest"
import { Input } from "@/components/ui/Input"

describe("Input ref forwarding (React 19 native ref prop)", () => {
  it("populates the ref with the underlying input element", () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} label="Email" />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("INPUT")
  })

  it("ref can be used to programmatically focus the input", () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} label="Password" />)
    ref.current?.focus()
    expect(document.activeElement).toBe(ref.current)
  })
})
