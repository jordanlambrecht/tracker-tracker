// src/components/ui/StatCard.tsx

import clsx from "clsx"
import type { HTMLAttributes, ReactNode } from "react"
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
  className,
  style,
  ...props
}: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null

  return (
    <div
      className={clsx("bg-raised p-5 flex flex-col gap-2 nm-raised rounded-nm-lg", className)}
      style={{
        filter: accentColor ? `drop-shadow(0 -2px 12px ${hexToRgba(accentColor, 0.1)})` : undefined,
        ...style,
      }}
      {...props}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
          {label}
        </p>
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
          <span className="font-mono text-sm text-tertiary leading-none mb-1">
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

