// src/components/ui/StatCard.tsx
import type { HTMLAttributes } from "react"

type TrendDirection = "up" | "down" | "flat"

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  subValue?: string
  trend?: TrendDirection
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
  trend,
  className = "",
  ...props
}: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null

  return (
    <div
      className={[
        "bg-raised rounded-lg border border-border p-4 flex flex-col gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <span className="font-mono text-2xl font-semibold text-primary leading-none">
          {value}
        </span>
        {trendInfo && (
          <span
            className={["font-mono text-sm leading-none mb-0.5", trendInfo.colorClass].join(" ")}
            title={trendInfo.label}
          >
            <span className="sr-only">{trendInfo.label}</span>
            <span aria-hidden="true">{trendInfo.symbol}</span>
          </span>
        )}
      </div>
      {subValue && (
        <p className="font-mono text-xs text-tertiary">{subValue}</p>
      )}
    </div>
  )
}

export { StatCard }
export type { StatCardProps, TrendDirection }
