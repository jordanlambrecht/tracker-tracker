// src/components/dashboard/AlertsBanner.tsx
"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import type { DashboardAlert } from "@/lib/dashboard"
import { formatDateTime } from "@/lib/formatters"

interface AlertsBannerProps {
  alerts: DashboardAlert[]
  onDismiss: (key: string, type: string) => void
  onDismissAll?: () => void
}

const typeConfig: Record<string, { borderColor: string; icon: string; label: string }> = {
  error: { borderColor: "var(--color-danger)", icon: "✕", label: "Error" },
  "ratio-danger": { borderColor: "var(--color-danger)", icon: "▼", label: "Ratio" },
  "stale-data": { borderColor: "var(--color-warn)", icon: "⏱", label: "Stale" },
  "rank-change": { borderColor: "var(--color-accent)", icon: "🎉", label: "Rank" },
  "zero-seeding": { borderColor: "var(--color-warn)", icon: "⏸", label: "Seeds" },
  warned: { borderColor: "var(--color-danger)", icon: "⚠", label: "Warning" },
  anniversary: { borderColor: "var(--color-accent)", icon: "🎂", label: "Anniversary" },
  "update-available": { borderColor: "var(--color-accent)", icon: "⬆", label: "Update" },
  "backup-failed": { borderColor: "var(--color-warn)", icon: "⚠", label: "Backup" },
  "client-error": { borderColor: "var(--color-danger)", icon: "⏹", label: "Client" },
  "poll-paused": { borderColor: "var(--color-danger)", icon: "⏸", label: "Paused" },
}

function AlertsBanner({ alerts, onDismiss, onDismissAll }: AlertsBannerProps) {
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  const handleDismiss = useCallback(
    (key: string, type: string) => {
      setDismissing((prev) => new Set([...prev, key]))
      setTimeout(() => {
        onDismiss(key, type)
        setDismissing((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }, 250)
    },
    [onDismiss]
  )

  const handleDismissAll = useCallback(() => {
    const dismissibleKeys = alerts.filter((a) => a.dismissible !== false).map((a) => a.key)
    setDismissing(new Set(dismissibleKeys))
    setTimeout(() => {
      onDismissAll?.()
      setDismissing(new Set())
    }, 250)
  }, [alerts, onDismissAll])

  if (alerts.length === 0) return null

  const dismissibleAlerts = alerts.filter((a) => a.dismissible !== false)

  return (
    <div className="flex flex-col gap-2">
      {onDismissAll && dismissibleAlerts.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDismissAll}
            className="timestamp hover:text-secondary transition-colors duration-150 cursor-pointer uppercase tracking-wider"
          >
            Clear All
          </button>
        </div>
      )}
      {alerts.map((alert, i) => {
        const config = typeConfig[alert.type] ?? typeConfig.error
        const isDismissing = dismissing.has(alert.key)
        return (
          <div
            key={alert.key}
            className="overflow-hidden transition-all duration-250 ease-out"
            style={{
              maxHeight: isDismissing ? 0 : 80,
              marginBottom: isDismissing ? -8 : 0,
              opacity: isDismissing ? 0 : 1,
              animationName: "alertSlideIn",
              animationDuration: "200ms",
              animationTimingFunction: "ease-out",
              animationFillMode: "backwards",
              animationDelay: `${i * 30}ms`,
            }}
          >
            <div
              className="flex items-start sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 nm-inset-sm bg-control-bg rounded-nm-md transition-transform duration-250 ease-out"
              style={{
                borderLeft: `3px solid ${config.borderColor}`,
                transform: isDismissing ? "translateX(-12px)" : "translateX(0)",
              }}
            >
              <span className="shrink-0 text-sm mt-0.5 sm:mt-0" aria-hidden="true">
                {config.icon}
              </span>
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
                {alert.trackerId !== null ? (
                  <Link
                    href={`/trackers/${alert.trackerId}`}
                    className="font-mono text-xs font-semibold text-secondary uppercase tracking-wider shrink-0 hover:text-primary transition-colors duration-150"
                  >
                    {alert.trackerName}
                  </Link>
                ) : (
                  <span className="font-mono text-xs font-semibold text-secondary uppercase tracking-wider shrink-0">
                    {alert.trackerName}
                  </span>
                )}
                <span className="font-mono text-xs text-tertiary truncate">{alert.message}</span>
              </div>
              {alert.timestamp && (
                <span className="timestamp shrink-0 hidden sm:block">
                  {formatDateTime(alert.timestamp)}
                </span>
              )}
              {alert.dismissible !== false && (
                <button
                  type="button"
                  onClick={() => handleDismiss(alert.key, alert.type)}
                  className="text-muted hover:text-secondary transition-colors duration-150 cursor-pointer shrink-0 px-1 mt-0.5 sm:mt-0"
                  aria-label={`Dismiss ${config.label} alert for ${alert.trackerName}`}
                >
                  x
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { AlertsBanner }
