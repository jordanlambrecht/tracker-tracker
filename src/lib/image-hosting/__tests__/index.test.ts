// src/lib/image-hosting/__tests__/index.test.ts
import { describe, expect, it } from "vitest"
import { getImageHostAdapter } from "../index"

describe("getImageHostAdapter", () => {
  it("returns ptpimg adapter", () => {
    expect(getImageHostAdapter("ptpimg").id).toBe("ptpimg")
  })

  it("returns onlyimage adapter", () => {
    expect(getImageHostAdapter("onlyimage").id).toBe("onlyimage")
  })

  it("returns imgbb adapter", () => {
    expect(getImageHostAdapter("imgbb").id).toBe("imgbb")
  })

  it("throws for unknown host", () => {
    // @ts-expect-error — testing runtime guard
    expect(() => getImageHostAdapter("unknown")).toThrow("Unknown image host")
  })
})
