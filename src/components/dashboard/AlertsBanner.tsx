// src/components/dashboard/AlertsBanner.tsx
"use client"

import { cva } from "class-variance-authority"
import clsx from "clsx"
import Link from "next/link"
import { useCallback, useState } from "react"
import type { DashboardAlert } from "@/lib/dashboard"
import { formatDateTime } from "@/lib/formatters"

// ── CVA variants ──

type AlertSeverity = "danger" | "warn" | "accent"

const alertRowVariants = cva(
  "flex items-start sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 nm-inset-sm bg-control-bg rounded-nm-md border-l-3 transition-transform duration-200 ease-out",
  {
    variants: {
      severity: {
        danger: "border-l-danger",
        warn: "border-l-warn",
        accent: "border-l-accent",
      },
    },
    defaultVariants: { severity: "danger" },
  }
)

// ── Type config ──

interface AlertsBannerProps {
  alerts: DashboardAlert[]
  onDismiss: (key: string, type: string) => void
  onDismissAll?: () => void
}

const typeConfig: Record<string, { severity: AlertSeverity; icon: string; label: string }> = {
  error: { severity: "danger", icon: "✕", label: "Error" },
  "ratio-danger": { severity: "danger", icon: "▼", label: "Ratio" },
  "stale-data": { severity: "warn", icon: "⏱", label: "Stale" },
  "rank-change": { severity: "accent", icon: "🎉", label: "Rank" },
  "zero-seeding": { severity: "warn", icon: "⏸", label: "Seeds" },
  warned: { severity: "danger", icon: "⚠", label: "Warning" },
  anniversary: { severity: "accent", icon: "🎂", label: "Anniversary" },
  "update-available": { severity: "accent", icon: "⬆", label: "Update" },
  "backup-failed": { severity: "warn", icon: "⚠", label: "Backup" },
  "client-error": { severity: "danger", icon: "⏹", label: "Client" },
  "poll-paused": { severity: "danger", icon: "⏸", label: "Paused" },
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
            className="overflow-hidden transition-all duration-200 ease-out"
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
              className={clsx(
                alertRowVariants({ severity: config.severity }),
                isDismissing ? "-translate-x-3" : "translate-x-0"
              )}
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
