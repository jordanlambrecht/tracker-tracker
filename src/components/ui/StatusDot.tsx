// src/components/ui/StatusDot.tsx

import clsx from "clsx"

type StatusDotTone = "success" | "warn" | "danger" | "muted"

interface StatusDotProps {
  tone: StatusDotTone
  className?: string
}

// The glow is a drop shadow in currentColor, so each tone sets the text colour too.
// Like PulseDot, every live state glows and only an unknown or stale one is still.
const TONE_CLASSES: Record<StatusDotTone, string> = {
  success: "bg-success text-success animate-pulse-glow",
  warn: "bg-warn text-warn animate-pulse-glow",
  danger: "bg-danger text-danger animate-pulse-glow",
  muted: "bg-muted text-muted",
}

/**
 * The status light on service cards such as TrackerHub and Mousehole. The text
 * beside it names the state, so it is hidden from screen readers; PulseDot is
 * the one for tracker health.
 */
function StatusDot({ tone, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx("inline-block w-2 h-2 rounded-full shrink-0", TONE_CLASSES[tone], className)}
    />
  )
}

export type { StatusDotProps, StatusDotTone }
export { StatusDot }
