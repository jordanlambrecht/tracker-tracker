// src/components/charts/lib/__tests__/defaultShouldSetOption.test.ts
//
// Tests for defaultShouldSetOption — the chart update guard that decides
// whether echarts-for-react should call setOption on re-render.

import { describe, expect, it } from "vitest"
import { defaultShouldSetOption } from "@/components/charts/lib/ChartECharts"

describe("defaultShouldSetOption", () => {
  // -------------------------------------------------------------------------
  // Reference-equality fast paths
  // -------------------------------------------------------------------------

  it("returns false when option is the same reference (no style change)", () => {
    const option = { series: [{ name: "Upload", data: [1, 2, 3] }] }
    const prev = { option, style: undefined }
    const next = { option, style: undefined }
    expect(defaultShouldSetOption(prev, next)).toBe(false)
  })

  it("returns false when both option and style are the same references", () => {
    const option = { series: [] }
    const style = { height: "300px" }
    expect(defaultShouldSetOption({ option, style }, { option, style })).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Style change forces an update regardless of option
  // -------------------------------------------------------------------------

  it("returns true when style reference changes even if option is identical reference", () => {
    const option = { series: [] }
    const prev = { option, style: { height: "200px" } }
    const next = { option, style: { height: "300px" } }
    expect(defaultShouldSetOption(prev, next)).toBe(true)
  })

  it("returns true when style goes from defined to undefined", () => {
    const option = { series: [] }
    expect(
      defaultShouldSetOption({ option, style: { height: "300px" } }, { option, style: undefined })
    ).toBe(true)
  })

  it("returns true when style goes from undefined to defined", () => {
    const option = { series: [] }
    expect(
      defaultShouldSetOption({ option, style: undefined }, { option, style: { height: "300px" } })
    ).toBe(true)
  })

  // -------------------------------------------------------------------------
  // JSON.stringify equality: different references, same serialized content
  // -------------------------------------------------------------------------

  it("returns false when option references differ but JSON content is identical", () => {
    const prev = { option: { series: [{ name: "Upload", data: [1, 2, 3] }] }, style: undefined }
    const next = { option: { series: [{ name: "Upload", data: [1, 2, 3] }] }, style: undefined }
    expect(defaultShouldSetOption(prev, next)).toBe(false)
  })

  it("returns false when deeply nested options are equal by value", () => {
    const makeOption = () => ({
      xAxis: { type: "category", data: ["Mon", "Tue", "Wed"] },
      yAxis: { type: "value" },
      series: [{ name: "Upload", type: "line", data: [100, 200, 300] }],
      color: ["#00d4ff", "#f59e0b"],
    })
    expect(defaultShouldSetOption({ option: makeOption() }, { option: makeOption() })).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Actual data changes trigger an update
  // -------------------------------------------------------------------------

  it("returns true when option data changes", () => {
    const prev = { option: { series: [{ data: [1, 2, 3] }] } }
    const next = { option: { series: [{ data: [1, 2, 4] }] } }
    expect(defaultShouldSetOption(prev, next)).toBe(true)
  })

  it("returns true when series count changes", () => {
    const prev = { option: { series: [{ name: "A" }] } }
    const next = { option: { series: [{ name: "A" }, { name: "B" }] } }
    expect(defaultShouldSetOption(prev, next)).toBe(true)
  })

  it("returns true when a key is added to option", () => {
    const prev = { option: { series: [] } }
    const next = { option: { series: [], title: { text: "New Title" } } }
    expect(defaultShouldSetOption(prev, next)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Function values in options: JSON.stringify drops them so they are ignored
  // -------------------------------------------------------------------------

  it("returns false when options differ only by formatter function closures (same data)", () => {
    // JSON.stringify drops function values entirely, so two options with identical
    // data but different formatter closures serialize to the same string.
    const dataA = [100, 200, 300]
    const prev = {
      option: {
        series: [{ data: dataA }],
        tooltip: { formatter: (p: unknown) => `${p}A` },
      },
    }
    const next = {
      option: {
        series: [{ data: dataA }],
        tooltip: { formatter: (p: unknown) => `${p}B` },
      },
    }
    // Different function references, same data — must NOT trigger setOption.
    expect(defaultShouldSetOption(prev, next)).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Null/undefined option handling
  // -------------------------------------------------------------------------

  it("returns false when both options are undefined", () => {
    expect(defaultShouldSetOption({ option: undefined }, { option: undefined })).toBe(false)
  })

  it("returns false when both options are null", () => {
    expect(defaultShouldSetOption({ option: null }, { option: null })).toBe(false)
  })

  it("returns true when option goes from undefined to a real object", () => {
    expect(defaultShouldSetOption({ option: undefined }, { option: { series: [] } })).toBe(true)
  })

  it("returns true when option goes from a real object to undefined", () => {
    expect(defaultShouldSetOption({ option: { series: [] } }, { option: undefined })).toBe(true)
  })

  it("returns false when both options are empty objects (different references)", () => {
    expect(defaultShouldSetOption({ option: {} }, { option: {} })).toBe(false)
  })
})
