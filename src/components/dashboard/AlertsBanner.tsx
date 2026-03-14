// src/components/dashboard/AlertsBanner.tsx
//
// Functions: AlertsBanner

"use client"

import Link from "next/link"
import type { DashboardAlert } from "@/lib/dashboard"

interface AlertsBannerProps {
  alerts: DashboardAlert[]
  onDismiss: (key: string) => void
}

const typeConfig: Record<string, { borderColor: string; icon: string; label: string }> = {
  error: { borderColor: "var(--color-danger)", icon: "✕", label: "Error" },
  "ratio-danger": { borderColor: "var(--color-danger)", icon: "▼", label: "Ratio" },
  "stale-data": { borderColor: "var(--color-warn)", icon: "⏱", label: "Stale" },
  "rank-change": { borderColor: "var(--color-accent)", icon: "🎉", label: "Rank" },
  "zero-seeding": { borderColor: "var(--color-warn)", icon: "⏸", label: "Seeds" },
  warned: { borderColor: "var(--color-danger)", icon: "⚠", label: "Warning" },
  anniversary: { borderColor: "var(--color-accent)", icon: "🎂", label: "Anniversary" },
}

function AlertsBanner({ alerts, onDismiss }: AlertsBannerProps) {
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const config = typeConfig[alert.type] ?? typeConfig.error
        return (
          <div
            key={alert.key}
            className="flex items-start sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 nm-inset-sm bg-control-bg rounded-nm-md"
            style={{ borderLeft: `3px solid ${config.borderColor}` }}
          >
            <span className="shrink-0 text-sm mt-0.5 sm:mt-0" aria-hidden="true">
              {config.icon}
            </span>
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
              <Link
                href={`/trackers/${alert.trackerId}`}
                className="font-mono text-xs font-semibold text-secondary uppercase tracking-wider shrink-0 hover:text-primary transition-colors duration-150"
              >
                {alert.trackerName}
              </Link>
              <span className="font-mono text-xs text-tertiary truncate">
                {alert.message}
              </span>
            </div>
            {alert.timestamp && (
              <span className="font-mono text-[10px] text-muted shrink-0 hidden sm:block">
                {new Date(alert.timestamp).toLocaleString()}
              </span>
            )}
            <button
              type="button"
              onClick={() => onDismiss(alert.key)}
              className="text-muted hover:text-secondary transition-colors duration-150 cursor-pointer shrink-0 px-1 mt-0.5 sm:mt-0"
              aria-label={`Dismiss ${config.label} alert for ${alert.trackerName}`}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

export { AlertsBanner }
