// src/components/charts/lib/ChartECharts.tsx

// Drop-in replacement for ReactECharts that renders the legend as HTML
// outside the canvas so the chart never shrinks and makes the card grow instead.
// Listens to legendselectchanged to track state, dispatches legend actions
// via the ECharts instance ref.

"use client"

import clsx from "clsx"
import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { CHART_THEME } from "./theme"

interface LegendItem {
  name: string
  color: string
}

interface ChartEChartsProps {
  option: EChartsOption
  style?: CSSProperties
  opts?: { renderer?: "canvas" | "svg" }
  notMerge?: boolean
  lazyUpdate?: boolean
}

const DEFAULT_OPTS = { renderer: "canvas" as const }

/** Extract legend items from ECharts option — series names + colors */
function extractLegendItems(option: EChartsOption): LegendItem[] {
  const series = option.series as
    | Array<{ name?: string; itemStyle?: { color?: string } }>
    | undefined
  if (!Array.isArray(series)) return []

  const globalColors = (option.color as string[] | undefined) ?? []
  const legend = option.legend as { data?: string[] } | undefined
  const allowedNames = legend?.data ? new Set(legend.data) : null

  const seen = new Set<string>()
  const items: LegendItem[] = []

  for (let i = 0; i < series.length; i++) {
    const s = series[i]
    const name = s.name ?? ""
    if (!name) continue
    if (allowedNames && !allowedNames.has(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    items.push({
      name,
      color: s.itemStyle?.color ?? globalColors[i % globalColors.length] ?? CHART_THEME.accent,
    })
  }

  return items
}

function ChartECharts({
  option,
  style,
  opts = DEFAULT_OPTS,
  notMerge = false,
  lazyUpdate = true,
}: ChartEChartsProps) {
  const chartRef = useRef<ReactECharts | null>(null)

  // Determine if this chart has a multi-item legend
  const legend = option.legend as Record<string, unknown> | undefined
  const hasLegend = legend && legend.show !== false
  const series = option.series as Array<{ name?: string }> | undefined
  const seriesCount = Array.isArray(series) ? series.length : 0
  const showExternalLegend = hasLegend && seriesCount > 1

  // Extract legend items — stabilized by content key to avoid unnecessary re-renders
  const legendItemsRaw = showExternalLegend ? extractLegendItems(option) : []
  const legendKey = legendItemsRaw.map((i) => `${i.name}:${i.color}`).join(",")
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on legendKey string, not legendItemsRaw reference — stabilizes the array across renders when content hasn't changed
  const legendItems = useMemo(() => legendItemsRaw, [legendKey])

  // Track which series are selected — keyed by series name
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  // Sync selection state when legend items actually change (not on every render)
  const prevLegendKeyRef = useRef("")
  useEffect(() => {
    if (legendKey !== prevLegendKeyRef.current && legendItems.length > 0) {
      prevLegendKeyRef.current = legendKey
      setSelected(Object.fromEntries(legendItems.map((item) => [item.name, true])))
    }
  }, [legendKey, legendItems])

  const allSelected = Object.values(selected).length > 0 && Object.values(selected).every(Boolean)

  // Sync selection state from ECharts events (individual toggle clicks)
  const onEvents = useMemo(
    () => ({
      legendselectchanged: (params: { selected: Record<string, boolean> }) => {
        setSelected(params.selected)
      },
    }),
    []
  )

  const handleToggleAll = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return

    if (allSelected) {
      instance.dispatchAction({ type: "legendInverseSelect" })
      setSelected((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, false])))
    } else {
      instance.dispatchAction({ type: "legendAllSelect" })
      setSelected((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, true])))
    }
  }, [allSelected])

  const handleToggleSeries = useCallback((name: string) => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return
    instance.dispatchAction({ type: "legendToggleSelect", name })
  }, [])

  // Hide internal legend when rendering externally — immutable shallow copy
  // instead of mutating the parent's option object during render.
  const effectiveOption = useMemo(() => {
    if (!showExternalLegend || !option.legend) return option
    return { ...option, legend: { ...(option.legend as object), show: false } }
  }, [option, showExternalLegend])

  return (
    <div className="flex flex-col gap-0">
      {/* External HTML legend */}
      {showExternalLegend && legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 px-4">
          {legendItems.map((item) => {
            const isActive = selected[item.name] !== false
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => handleToggleSeries(item.name)}
                className={clsx(
                  "flex items-center gap-1.5 text-3xs font-mono cursor-pointer transition-all duration-150 bg-transparent border-none px-1.5 py-0.5 rounded-nm-sm hover:bg-overlay/50",
                  isActive ? "opacity-100" : "opacity-30"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span style={{ color: CHART_THEME.textTertiary }}>{item.name}</span>
              </button>
            )
          })}
          <Button
            variant="minimal"
            size="sm"
            onClick={handleToggleAll}
            className="torrent-cell hover:bg-overlay"
            text={allSelected ? "None" : "All"}
          />
        </div>
      )}

      {/* Chart canvas */}
      <div className="relative">
        <ReactECharts
          ref={chartRef}
          option={effectiveOption}
          style={style}
          opts={opts}
          notMerge={notMerge}
          lazyUpdate={lazyUpdate}
          onEvents={onEvents}
        />
      </div>
    </div>
  )
}

export type { ChartEChartsProps }
export { ChartECharts }
