// src/components/ui/__tests__/Button.ref.test.tsx

import { render } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it } from "vitest"
import { Button } from "@/components/ui/Button"

describe("Button ref forwarding (React 19 native ref prop)", () => {
  it("populates the ref with the underlying button element", () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Click</Button>)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("BUTTON")
  })

  it("ref is null after unmount", () => {
    const ref = createRef<HTMLButtonElement>()
    const { unmount } = render(<Button ref={ref}>X</Button>)
    expect(ref.current).not.toBeNull()
    unmount()
    expect(ref.current).toBeNull()
  })
})
