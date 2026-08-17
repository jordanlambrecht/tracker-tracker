// src/components/charts/lib/OutageBandLegend.tsx
//
// Explains the hatched bands sitting behind a chart. Without this the bands are
// just unexplained shading, which trades one mystery for another.
//
// ── Only what is actually drawn ────────────────────────────────────────────
// A kind appears here only when that kind has at least one band in view, and
// the whole strip disappears when nothing is drawn. There is deliberately no
// "collecting normally" entry: a range with no band is UNKNOWN, not healthy,
// and a legend row claiming otherwise would be the one lie this feature exists
// to prevent.
//
// ── Accessibility ──────────────────────────────────────────────────────────
// The bands themselves are painted into the chart canvas: no DOM, no text, no
// effect on any screen-reader output. This strip is their only textual form, so
// it is real text rather than an aria-hidden decoration. It contains no buttons
// and nothing focusable, so it adds no tab stops — the swatches are pure
// decoration and are hidden from assistive tech, leaving the label to speak.

"use client"

import { hexToRgba } from "@/lib/color-utils"
import type { ChartOutageBands, OutageBandStyle } from "./outage-bands"
import { hasVisibleBands, OUTAGE_BAND_STYLES } from "./outage-bands"
import { CHART_THEME } from "./theme"

/**
 * CSS twin of the canvas hatch, so the swatch reads as a shrunken sample of the
 * band rather than an approximation of it.
 *
 * A gradient's stripes run PERPENDICULAR to its axis, so the CSS angle is the
 * mirror of the visual one: 135deg draws "/" and 45deg draws "\". The alphas
 * are stronger than the band's own, because a 16px swatch has to carry at a
 * glance what a chart-wide wash carries by area.
 */
function swatchBackground(style: OutageBandStyle): string {
  const angle = style.angle === "forward" ? "135deg" : "45deg"
  const stripe = hexToRgba(style.color, 0.55)
  const wash = hexToRgba(style.color, 0.12)
  return `repeating-linear-gradient(${angle}, ${stripe} 0 1.5px, ${wash} 1.5px 5.5px)`
}

interface OutageBandLegendProps {
  bands: ChartOutageBands
  className?: string
}

function OutageBandLegend({ bands, className }: OutageBandLegendProps) {
  if (!hasVisibleBands(bands)) return null

  const kinds: OutageBandStyle[] = []
  if (bands.app.length > 0) kinds.push(OUTAGE_BAND_STYLES.app)
  if (bands.qbt.length > 0) kinds.push(OUTAGE_BAND_STYLES.qbt)

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
