// src/components/charts/chart-helpers.ts
//
// Functions: fmtNum, yAxisPad, formatDateLabel

/** Locale-formatted number with fixed decimal places — used in chart tooltips and axis labels */
export function fmtNum(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format ISO date string to short locale label (e.g. "Mar 15") */
export function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Compute Y-axis padding so data doesn't press against chart edges */
export function yAxisPad(value: { min: number; max: number }): number {
  const range = value.max - value.min
  return Math.max(range * 0.15, (value.max || 1) * 0.001)
}
