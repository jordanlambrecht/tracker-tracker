// src/components/charts/lib/OutageBandLegend.tsx
"use client"

import { hexToRgba } from "@/lib/color-utils"
import type { Interval } from "@/lib/outages"
import type { ChartOutageBands, OutageBandStyle } from "./outage-bands"
import { clampBandsToRange, hasVisibleBands, OUTAGE_BAND_STYLES } from "./outage-bands"
import { CHART_THEME } from "./theme"

// CSS twin of the canvas hatch

function swatchBackground(style: OutageBandStyle): string {
  const angle = style.angle === "forward" ? "135deg" : "45deg"
  const stripe = hexToRgba(style.color, 0.55)
  const wash = hexToRgba(style.color, 0.12)
  return `repeating-linear-gradient(${angle}, ${stripe} 0 1.5px, ${wash} 1.5px 5.5px)`
}

interface OutageBandLegendProps {
  bands: ChartOutageBands
  /** The chart's own data span — the same value given to appendOutageBandSeries. */
  range?: Interval | null
  className?: string
}

function OutageBandLegend({ bands, range = null, className }: OutageBandLegendProps) {
  // Crop first, then ask what is visible
  const shown: ChartOutageBands = {
    app: clampBandsToRange(bands.app, range),
    qbt: clampBandsToRange(bands.qbt, range),
    tracker: clampBandsToRange(bands.tracker, range),
  }

  if (!hasVisibleBands(shown)) return null

  const kinds: OutageBandStyle[] = []
  if (shown.app.length > 0) kinds.push(OUTAGE_BAND_STYLES.app)
  if (shown.qbt.length > 0) kinds.push(OUTAGE_BAND_STYLES.qbt)
  // Scoping upstream means this can never appear alongside the qbt entry, so
  // the two sharing a hatch angle is not a collision. See OUTAGE_BAND_STYLES.
  if (shown.tracker.length > 0) kinds.push(OUTAGE_BAND_STYLES.tracker)

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-1 ${className ?? ""}`}
      data-testid="outage-band-legend"
    >
      {kinds.map((style) => (
        <span
          key={style.kind}
          title={style.description}
          className="flex items-center gap-1.5 text-3xs font-mono"
          style={{ color: CHART_THEME.textTertiary }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-4 shrink-0 rounded-nm-sm"
            style={{
              background: swatchBackground(style),
              border: `1px solid ${hexToRgba(style.color, 0.2)}`,
            }}
          />
          {style.label}
        </span>
      ))}
    </div>
  )
}

export type { OutageBandLegendProps }
export { OutageBandLegend }
