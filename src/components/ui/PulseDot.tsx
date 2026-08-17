// src/components/ui/PulseDot.tsx
import { cva } from "class-variance-authority"
import clsx from "clsx"

// Ordered loosely by severity, ascending, to mirror TrackerHealth. "no-seeds"
// shares the danger palette with "critical" and "paused" — this union
// distinguishes states by their accessible label, not by giving every member
// its own color.
type PulseDotStatus =
  | "healthy"
  | "warning"
  | "no-seeds"
  | "critical"
  | "error"
  | "paused"
  | "paused-user"
  | "offline"
type PulseDotSize = "sm" | "md"

interface PulseDotProps {
  status?: PulseDotStatus
  size?: PulseDotSize
  color?: string
  className?: string
  "aria-label"?: string
}

const statusLabels: Record<PulseDotStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  "no-seeds": "No seeds",
  critical: "Critical",
  paused: "Paused",
  "paused-user": "Paused by user",
  error: "Error",
  offline: "Offline",
}

const shouldPulse: Record<PulseDotStatus, boolean> = {
  healthy: true,
  warning: true,
  "no-seeds": true,
  critical: true,
  paused: false,
  "paused-user": false,
  error: false,
  offline: false,
}

const pulseDot = cva("inline-block rounded-full shrink-0", {
  variants: {
    status: {
      healthy: "text-accent bg-accent",
      warning: "text-warn bg-warn",
      "no-seeds": "text-danger bg-danger",
      critical: "text-danger bg-danger",
      paused: "text-danger bg-danger",
      "paused-user": "text-warn bg-warn",
      error: "text-secondary bg-secondary",
      offline: "text-muted bg-muted",
    },
    size: {
      sm: "w-2 h-2",
      md: "w-3 h-3",
    },
  },
  defaultVariants: {
    status: "healthy",
    size: "md",
  },
})

function PulseDot({
  status = "healthy",
  size = "md",
  color,
  className,
  "aria-label": ariaLabel,
}: PulseDotProps) {
  const pulse = shouldPulse[status]
  const useCustomColor = color && status === "healthy"

  return (
    <output
      aria-label={ariaLabel ?? statusLabels[status]}
      className={clsx(
        pulseDot({ status: useCustomColor ? undefined : status, size }),
        pulse ? "animate-pulse-glow" : "opacity-50",
        className
      )}
      style={useCustomColor ? { backgroundColor: color, color: color } : undefined}
    />
  )
}

export type { PulseDotProps, PulseDotSize, PulseDotStatus }
export { PulseDot }
