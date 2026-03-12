// src/components/charts/theme.ts
//
// Single source of truth for all chart color values. Mirrors the 3-layer
// token system in globals.css. Every chart component imports from here —
// never hardcode a hex in a chart file.
//
// Functions:
//   escHtml             - HTML-escape untrusted strings for ECharts tooltips
//   chartDot            - glowing dot swatch for tooltip rows
//   chartTooltipHeader  - timestamp header for tooltip content
//   formatChartTimestamp - locale-formatted date/time for chart tooltips
//   chartLegend         - standard legend configuration
//   buildTagColors      - golden-angle hue distribution for tag series
//   shouldUseLogScale   - detects when log scale improves readability
//   chartTooltip        - standard tooltip configuration
//   chartGrid           - standard grid margins
//   chartAxisLabel      - standard axis label styling

export const CHART_THEME = {
  // ── Surfaces ──
  surface:    "#282a36",   // --color-base
  elevated:   "#2e3042",   // --color-elevated
  overlay:    "#343648",   // --color-overlay
  controlBg:  "#1e2029",   // --color-control-bg
  tooltipBg:  "#2e3042",   // same as elevated
  surfaceSemi: "rgba(40, 42, 54, 0.6)", // semi-transparent base for slider backgrounds

  // ── Text ──
  textPrimary:   "#e2e8f0",   // --color-primary
  textSecondary: "#94a3b8",   // --color-secondary
  textTertiary:  "#64748b",   // --color-tertiary
  fontMono: "var(--font-mono), monospace",

  // ── Borders ──
  tooltipBorder:   "rgba(148, 163, 184, 0.2)",
  gridLine:        "rgba(148, 163, 184, 0.08)",  // --color-border
  borderEmphasis:  "rgba(148, 163, 184, 0.15)",  // --color-border-emphasis
  borderMid:       "rgba(148, 163, 184, 0.3)",   // axis pointers, label lines

  // ── Layer 1: Raw colors ──
  cyan:   "#00d4ff",
  amber:  "#f59e0b",
  red:    "#ef4444",
  green:  "#10b981",
  lime:   "#22c55e",
  violet: "#8b5cf6",
  sky:    "#06b6d4",

  // ── Layer 2: Semantic ──
  accent:  "#00d4ff",
  warn:    "#f59e0b",
  danger:  "#ef4444",
  success: "#10b981",

  // ── Layer 3: Purpose ──
  upload:   "#00d4ff",
  download: "#f59e0b",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral:  "#94a3b8",
  chartFallback: "#6b7280",  // gray-500, replaces "#888" in multi-series charts

  // Ordinal scale for ratio/seed-time distribution buckets
  scale: ["#ef4444", "#f59e0b", "#10b981", "#00d4ff", "#8b5cf6", "#06b6d4"] as const,

  // ── Glow variants (for areaStyle fills, shadows) ──
  accentDim:    "rgba(0, 212, 255, 0.15)",
  accentGlow:   "rgba(0, 212, 255, 0.3)",
  accentGlow40: "rgba(0, 212, 255, 0.4)",
  accentGlow60: "rgba(0, 212, 255, 0.6)",
  warnDim:      "rgba(245, 158, 11, 0.15)",
  warnGlow:     "rgba(245, 158, 11, 0.3)",
} as const


/** Escape HTML entities in untrusted strings before injecting into ECharts tooltip HTML */
export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Glowing dot swatch for tooltip rows */
export function chartDot(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;box-shadow:0 0 6px ${color};"></span>`
}

/** Locale-formatted date/time string for chart tooltips */
export function formatChartTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Timestamp header div for tooltip content */
export function chartTooltipHeader(label: string): string {
  return `<div style="font-family:var(--font-mono),monospace;font-size:11px;color:${CHART_THEME.textTertiary};margin-bottom:4px;">${escHtml(label)}</div>`
}

/** Standard legend configuration — plain wrapping, toggle handled by ChartECharts wrapper */
export function chartLegend(overrides?: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    type: "plain",
    top: 4,
    left: 56,
    right: 80,
    icon: "circle",
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 12,
    textStyle: {
      color: CHART_THEME.textTertiary,
      fontFamily: CHART_THEME.fontMono,
      fontSize: 11,
    },
    ...overrides,
  }
  // Strip keys explicitly set to undefined so ECharts doesn't see them
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key]
  }
  return merged
}

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
            lineStyle: { color: CHART_THEME.borderMid, opacity: 0.8 },
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
    top: 78,
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

