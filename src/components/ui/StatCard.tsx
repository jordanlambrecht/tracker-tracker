// src/components/ui/StatCard.tsx

"use client"

import clsx from "clsx"
import { type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react"
import { hexToRgba } from "@/lib/formatters"

type TrendDirection = "up" | "down" | "flat"

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  subValue?: string
  unit?: string
  subtitle?: string
  trend?: TrendDirection
  accentColor?: string
  icon?: ReactNode
  tooltip?: string
}

const trendConfig: Record<
  TrendDirection,
  { symbol: string; colorClass: string; label: string }
> = {
  up: { symbol: "▲", colorClass: "text-success", label: "Trending up" },
  down: { symbol: "▼", colorClass: "text-danger", label: "Trending down" },
  flat: { symbol: "—", colorClass: "text-secondary", label: "No change" },
}

function StatCard({
  label,
  value,
  subValue,
  unit,
  subtitle,
  trend,
  accentColor,
  icon,
  tooltip,
  className,
  style,
  ...props
}: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  function handleEnter() {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current)
    setShowTooltip(true)
  }

  function handleLeave() {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 150)
  }

  useEffect(() => {
    return () => { if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current) }
  }, [])

  return (
    <div
      className={clsx("bg-raised p-5 flex flex-col gap-2 nm-raised rounded-nm-lg overflow-visible relative", showTooltip && "z-50", className)}
      style={{
        filter: accentColor ? `drop-shadow(0 -2px 12px ${hexToRgba(accentColor, 0.1)})` : undefined,
        ...style,
      }}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 relative">
          <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
            {label}
          </p>
          {tooltip && (
            <button
              type="button"
              className="cursor-help text-[9px] font-bold text-muted opacity-50 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current hover:opacity-80 focus:opacity-80 transition-opacity outline-none"
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              onFocus={handleEnter}
              onBlur={handleLeave}
              aria-label={`Info: ${label}`}
            >
              ?
              {showTooltip && (
                <span role="tooltip" className="absolute left-0 top-full mt-1.5 z-50 w-52 px-3 py-2 text-[11px] font-sans font-normal normal-case tracking-normal text-secondary rounded-nm-sm leading-relaxed whitespace-normal" style={{ backgroundColor: "#343648", boxShadow: "4px 4px 8px #1b1c24, -4px -4px 8px #353848" }}>
                  {tooltip}
                </span>
              )}
            </button>
          )}
        </div>
        {icon && (
          <span className="text-tertiary shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="font-mono text-2xl font-semibold text-primary leading-none">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs font-normal text-muted leading-none mb-0.5">
            {unit}
          </span>
        )}
        {trendInfo && (
          <span
            className={clsx("font-mono text-sm leading-none mb-1", trendInfo.colorClass)}
            title={trendInfo.label}
          >
            <span className="sr-only">{trendInfo.label}</span>
            <span aria-hidden="true">{trendInfo.symbol}</span>
          </span>
        )}
      </div>
      {subtitle && (
        <p className="font-mono text-xs text-muted">{subtitle}</p>
      )}
      {subValue && (
        <p className="font-mono text-xs text-tertiary">{subValue}</p>
      )}
    </div>
  )
}

export { StatCard }
export type { StatCardProps, TrendDirection }
