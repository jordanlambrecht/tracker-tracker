// src/components/ui/PulseDot.tsx

type PulseDotStatus = "healthy" | "warning" | "critical" | "error" | "offline"
type PulseDotSize = "sm" | "md"

interface PulseDotProps {
  status?: PulseDotStatus
  size?: PulseDotSize
  className?: string
  "aria-label"?: string
}

const statusClasses: Record<PulseDotStatus, string> = {
  healthy: "text-accent bg-accent",
  warning: "text-warn bg-warn",
  critical: "text-danger bg-danger",
  error: "text-secondary bg-secondary",
  offline: "text-muted bg-muted",
}

const statusLabels: Record<PulseDotStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  error: "Error",
  offline: "Offline",
}

const sizeClasses: Record<PulseDotSize, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
}

const shouldPulse: Record<PulseDotStatus, boolean> = {
  healthy: true,
  warning: true,
  critical: true,
  error: false,
  offline: false,
}

function PulseDot({
  status = "healthy",
  size = "md",
  className = "",
  "aria-label": ariaLabel,
}: PulseDotProps) {
  const pulse = shouldPulse[status]

  return (
    <output
      aria-label={ariaLabel ?? statusLabels[status]}
      className={[
        "inline-block rounded-full flex-shrink-0",
        statusClasses[status],
        sizeClasses[size],
        pulse ? "animate-pulse-glow" : "opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  )
}

export { PulseDot }
export type { PulseDotProps, PulseDotStatus, PulseDotSize }
