// src/components/charts/ChartECharts.tsx
//
// Functions: ChartECharts
//
// Drop-in replacement for ReactECharts that adds an All/None legend toggle.
// Listens to legendselectchanged to track state, dispatches legendAllSelect
// or legendInverseSelect via the ECharts instance ref.

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { type CSSProperties, useCallback, useRef, useState } from "react"

interface ChartEChartsProps {
  option: EChartsOption
  style?: CSSProperties
  opts?: { renderer?: "canvas" | "svg" }
  notMerge?: boolean
  lazyUpdate?: boolean
}

function ChartECharts({ option, style, opts, notMerge, lazyUpdate }: ChartEChartsProps) {
  const chartRef = useRef<ReactECharts | null>(null)
  const [allSelected, setAllSelected] = useState(true)

  // Determine if this chart has a multi-item legend worth toggling
  const legend = option.legend as Record<string, unknown> | undefined
  const hasLegend = legend && legend.show !== false
  const series = option.series as Array<{ name?: string }> | undefined
  const seriesCount = Array.isArray(series) ? series.length : 0
  const showToggle = hasLegend && seriesCount > 1

  const onEvents: Record<string, (...args: never[]) => unknown> = {
    legendselectchanged: (params: { selected: Record<string, boolean> }) => {
      const values = Object.values(params.selected)
      setAllSelected(values.length > 0 && values.every(Boolean))
    },
  }

  const handleToggle = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return

    if (allSelected) {
      instance.dispatchAction({ type: "legendInverseSelect" })
      setAllSelected(false)
    } else {
      instance.dispatchAction({ type: "legendAllSelect" })
      setAllSelected(true)
    }
  }, [allSelected])

  return (
    <div className="relative">
      {showToggle && (
        <button
          type="button"
          onClick={handleToggle}
          className="absolute top-0 right-0 z-10 px-2.5 py-1 text-[11px] font-mono text-muted hover:text-secondary hover:bg-overlay transition-colors cursor-pointer rounded-nm-sm"
        >
          {allSelected ? "None" : "All"}
        </button>
      )}
      <ReactECharts
        ref={chartRef}
        option={option}
        style={style}
        opts={opts}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        onEvents={onEvents}
      />
    </div>
  )
}

export type { ChartEChartsProps }
export { ChartECharts }
