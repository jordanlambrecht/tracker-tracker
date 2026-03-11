// src/components/dashboard/DayRangeSidebar.tsx
//
// Functions: DayRangeSidebar

"use client"

import clsx from "clsx"
import { CHART_THEME } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"

type DayRange = 0 | 1 | 7 | 30 | 90 | 365

const DAY_RANGES: { value: DayRange; label: string }[] = [
  { value: 1, label: "24h" },
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1y" },
  { value: 0, label: "All" },
]

interface DayRangeSidebarProps {
  days: DayRange
  onChange: (days: DayRange) => void
  accentColor: string
}

function DayRangeSidebar({ days, onChange, accentColor }: DayRangeSidebarProps) {
  return (
    <div
      className="order-first md:order-none md:sticky md:top-6 flex flex-row flex-wrap md:flex-col gap-1 p-3 nm-raised-sm bg-elevated md:self-start md:ml-6 rounded-nm-lg"
    >
      <span className="w-full text-[9px] font-sans font-medium text-muted uppercase tracking-wider px-2 pb-1 md:pb-1">
        Range
      </span>
      {DAY_RANGES.map((d) => {
        const isActive = days === d.value
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onChange(d.value)}
            className={clsx(
              "px-3 py-1.5 text-xs font-mono transition-all duration-150 cursor-pointer text-center rounded-nm-sm",
              isActive ? "nm-inset-sm" : "hover:nm-raised-sm active:nm-inset-sm active:scale-[0.96]",
            )}
            style={
              isActive
                ? {
                    backgroundColor: hexToRgba(accentColor, 0.12),
                    color: accentColor,
                    fontWeight: 600,
                  }
                : { color: CHART_THEME.textTertiary }
            }
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

export { DayRangeSidebar, DAY_RANGES }
export type { DayRange, DayRangeSidebarProps }
