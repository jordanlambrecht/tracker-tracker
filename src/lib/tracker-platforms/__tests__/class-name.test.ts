// src/lib/tracker-platforms/__tests__/class-name.test.ts
//
// A class the tracker did not send must reach rank history as null. A blank
// string stored there reads as a class of its own.

import { describe, expect, it } from "vitest"
import { presentClass } from "../helpers/class-name"

describe("presentClass", () => {
  it("keeps a class the tracker sent", () => {
    expect(presentClass("Power User")).toBe("Power User")
  })

  it("reads a blank, missing or non-string class as none", () => {
    for (const value of ["", "   ", undefined, null, 42]) {
      expect(presentClass(value)).toBeNull()
    }
  })
})
