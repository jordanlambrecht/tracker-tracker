// src/components/ui/PulseDot.tsx
import { cva } from "class-variance-authority"
import clsx from "clsx"

type PulseDotStatus = "healthy" | "warning" | "critical" | "error" | "offline"
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
  critical: "Critical",
  error: "Error",
  offline: "Offline",
}

const shouldPulse: Record<PulseDotStatus, boolean> = {
  healthy: true,
  warning: true,
  critical: true,
  error: false,
  offline: false,
}

const pulseDot = cva("inline-block rounded-full shrink-0", {
  variants: {
    status: {
      healthy: "text-accent bg-accent",
      warning: "text-warn bg-warn",
      critical: "text-danger bg-danger",
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
        className,
      )}
      style={
        useCustomColor
          ? { backgroundColor: color, color: color }
          : undefined
      }
    />
  )
}

export { PulseDot }
export type { PulseDotProps, PulseDotStatus, PulseDotSize }
