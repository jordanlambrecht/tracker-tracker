// src/components/charts/theme.ts
//
// Shared ECharts theme constants and option builder functions for all chart components.
// Maps to the design system palette in .interface-design/system.md.
//
// Functions:
//   buildTagColors     - golden-angle hue distribution for tag series
//   shouldUseLogScale  - detects when log scale improves readability
//   chartTooltip       - standard tooltip configuration
//   chartGrid          - standard grid margins
//   chartAxisLabel     - standard axis label styling
//   chartSplitLine     - standard split line styling

export const CHART_THEME = {
  tooltipBg: "#2e3042",       // bg-elevated
  tooltipBorder: "rgba(148, 163, 184, 0.2)",
  textPrimary: "#e2e8f0",     // text-primary
  textSecondary: "#94a3b8",   // text-secondary
  textTertiary: "#64748b",    // text-tertiary
  fontMono: "var(--font-mono), monospace",
  gridLine: "rgba(148, 163, 184, 0.08)", // border-soft
  surface: "#282a36",         // bg-base
} as const

/** Golden-angle hue distribution for maximum visual separation of chart series */
export function buildTagColors(tags: string[]): Map<string, string> {
  const colorMap = new Map<string, string>()
  tags.forEach((tag, i) => {
    const hue = (i * 137.5) % 360
    colorMap.set(tag, `hsl(${hue}, 70%, 55%)`)
  })
  return colorMap
}

/**
 * Returns true when positive values span more than 2 orders of magnitude,
 * meaning a log scale would make the chart far more readable.
 * Zeros and negatives are excluded from the ratio check (they can't
 * appear on log axes), but their presence doesn't block detection.
 */
export function shouldUseLogScale(values: number[]): boolean {
  const positive = values.filter((v) => v > 0)
  if (positive.length < 2) return false
  const max = Math.max(...positive)
  const min = Math.min(...positive)
  return max / min > 100
}

/**
 * Standard tooltip configuration.
 * @param trigger - "axis" for line/bar charts, "item" for pie/scatter
 * @param overrides - Additional tooltip properties to merge
 */
export function chartTooltip(
  trigger: "axis" | "item" | "none" = "axis",
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    trigger,
    appendToBody: true,
    backgroundColor: CHART_THEME.tooltipBg,
    borderColor: CHART_THEME.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: {
      color: CHART_THEME.textPrimary,
      fontFamily: CHART_THEME.fontMono,
      fontSize: 12,
    },
    ...(trigger === "axis"
      ? {
          axisPointer: {
            type: "line" as const,
            lineStyle: { color: "rgba(148, 163, 184, 0.3)", opacity: 0.8 },
          },
        }
      : {}),
    ...overrides,
  }
}

/**
 * Standard grid margins.
 */
export function chartGrid(overrides?: {
  left?: number
  right?: number
  top?: number
  bottom?: number
  containLabel?: boolean
}): Record<string, unknown> {
  return {
    left: 56,
    right: 24,
    top: 24,
    bottom: 40,
    containLabel: false,
    ...overrides,
  }
}

/**
 * Standard axis label styling.
 */
export function chartAxisLabel(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: 10,
    ...overrides,
  }
}

/**
 * Standard split line styling for axes.
 */
export function chartSplitLine(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    lineStyle: { color: CHART_THEME.gridLine },
    ...overrides,
  }
}
