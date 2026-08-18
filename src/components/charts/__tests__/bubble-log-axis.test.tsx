// src/components/charts/__tests__/bubble-log-axis.test.tsx
//
// The bubble chart's log axes carry explicit min/max. Asserting on the option
// object alone proves nothing here: the option is always internally consistent,
// and the defect lives in ECharts' merge. ChartECharts renders with notMerge
// false, so a bound the next option omits keeps the value merged from the
// previous one. These drive a real instance and read the answer back off
// getOption().
//
// Which transitions can actually leak is not obvious, and the two cases below
// pin down both answers. "log" and "value" are different axis component
// SUBTYPES (xAxis.log / xAxis.value), so flipping the scale type makes ECharts
// replace the axis model outright and nothing survives. A log -> log render
// merges, and that is where an omitted bound persists.
//
// jsdom has no 2D canvas context, so the SVG renderer and an explicit size are
// both required for init to produce a usable chart.

import * as echarts from "echarts"
import { describe, expect, it } from "vitest"
import { buildBubbleOption } from "@/components/charts/TrackerBubbleChart"

// Both axes stay under 1024 GiB so autoByteScale keeps the unit at GiB and the
// divisor at 1, which makes the expected log bounds readable: half the smallest
// positive value to twice the largest.
const GiB = 1024 ** 3
const withData = [
  {
    name: "Alpha",
    color: "#ff0000",
    downloadedBytes: String(GiB),
    uploadedBytes: String(2 * GiB),
    seedingCount: 10,
  },
  {
    name: "Beta",
    color: "#00ff00",
    downloadedBytes: String(500 * GiB),
    uploadedBytes: String(400 * GiB),
    seedingCount: 40,
  },
]

// Same trackers, nothing transferred yet. Log stays ON only because the user
// forced it; auto-detection needs two positive values and would give up here.
const allZero = withData.map((t) => ({ ...t, downloadedBytes: "0", uploadedBytes: "0" }))

const X_LOG_MIN = 0.5
const X_LOG_MAX = 1000
const Y_LOG_MIN = 1
const Y_LOG_MAX = 800

function withChart(run: (chart: echarts.ECharts) => void) {
  const el = document.createElement("div")
  document.body.appendChild(el)
  const chart = echarts.init(el, null, { renderer: "svg", width: 400, height: 300 })
  try {
    run(chart)
  } finally {
    chart.dispose()
    el.remove()
  }
}

interface MergedAxis {
  type?: string
  min?: unknown
  max?: unknown
}

function mergedAxes(chart: echarts.ECharts) {
  const opt = chart.getOption() as { xAxis: MergedAxis[]; yAxis: MergedAxis[] }
  return { x: opt.xAxis[0], y: opt.yAxis[0] }
}

describe("TrackerBubbleChart axis bounds against a real ECharts instance", () => {
  it("computes the log bounds this fixture is written around", () => {
    const { xAxis, yAxis } = buildBubbleOption(withData, true) as {
      xAxis: { min?: number; max?: number }
      yAxis: { min?: number; max?: number }
    }
    expect(xAxis.min).toBe(X_LOG_MIN)
    expect(xAxis.max).toBe(X_LOG_MAX)
    expect(yAxis.min).toBe(Y_LOG_MIN)
    expect(yAxis.max).toBe(Y_LOG_MAX)
  })

  it("clears the stale log bounds when a forced-log render has no positive values", () => {
    withChart((chart) => {
      chart.setOption(buildBubbleOption(withData, true))
      chart.setOption(buildBubbleOption(allZero, true), { notMerge: false })

      // The axis type is unchanged, so this render merges rather than replaces.
      // Bounds derived from data that is no longer on screen must not survive it.
      const { x, y } = mergedAxes(chart)
      expect(x.type).toBe("log")
      expect(x.min).not.toBe(X_LOG_MIN)
      expect(x.max).not.toBe(X_LOG_MAX)
      expect(x.min ?? null).toBeNull()
      expect(x.max ?? null).toBeNull()

      expect(y.type).toBe("log")
      expect(y.min).not.toBe(Y_LOG_MIN)
      expect(y.max).not.toBe(Y_LOG_MAX)
      expect(y.min ?? null).toBeNull()
      expect(y.max ?? null).toBeNull()
    })
  })

  it("applies the log bounds when positive values arrive on a forced-log axis", () => {
    withChart((chart) => {
      chart.setOption(buildBubbleOption(allZero, true))
      chart.setOption(buildBubbleOption(withData, true), { notMerge: false })

      const { x, y } = mergedAxes(chart)
      expect(x.min).toBe(X_LOG_MIN)
      expect(x.max).toBe(X_LOG_MAX)
      expect(y.min).toBe(Y_LOG_MIN)
      expect(y.max).toBe(Y_LOG_MAX)
    })
  })

  // Characterization, not a regression guard: this passes with or without the
  // clearing values above, because flipping the scale type swaps the axis model
  // for a fresh one. It is here so the next reader does not re-derive it.
  it("carries no log bound across a scale type flip in either direction", () => {
    withChart((chart) => {
      chart.setOption(buildBubbleOption(withData, true))
      chart.setOption(buildBubbleOption(withData, false), { notMerge: false })

      const { x, y } = mergedAxes(chart)
      expect(x.type).toBe("value")
      expect(y.type).toBe("value")
      // min is legitimately 0 on the linear branch, so it is compared exactly
      // rather than for falsiness.
      expect(x.min).toBe(0)
      expect(y.min).toBe(0)
      expect(x.max ?? null).toBeNull()
      expect(y.max ?? null).toBeNull()
    })

    withChart((chart) => {
      chart.setOption(buildBubbleOption(withData, false))
      chart.setOption(buildBubbleOption(withData, true), { notMerge: false })

      const { x, y } = mergedAxes(chart)
      expect(x.type).toBe("log")
      expect(x.min).toBe(X_LOG_MIN)
      expect(x.max).toBe(X_LOG_MAX)
      expect(y.min).toBe(Y_LOG_MIN)
      expect(y.max).toBe(Y_LOG_MAX)
    })
  })

  it("stays visible to ChartECharts' JSON.stringify guard", () => {
    // defaultShouldSetOption skips setOption when the serialised options match,
    // and JSON.stringify drops undefined-valued keys — so the clearing values
    // are invisible to it and cannot carry the change on their own. The series
    // data differs across the leaking transition, and the axis type and name
    // differ across the scale flip, which is what keeps both reachable.
    const forcedLogWithData = JSON.stringify(buildBubbleOption(withData, true))
    const forcedLogAllZero = JSON.stringify(buildBubbleOption(allZero, true))
    expect(forcedLogWithData).not.toBe(forcedLogAllZero)
    expect(forcedLogWithData).not.toBe(JSON.stringify(buildBubbleOption(withData, false)))

    expect(JSON.parse(forcedLogAllZero).xAxis).not.toHaveProperty("max")
    expect(JSON.parse(JSON.stringify(buildBubbleOption(withData, false))).xAxis).not.toHaveProperty(
      "max"
    )
  })
})
