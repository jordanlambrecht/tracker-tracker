// src/components/ui/ProgressBar.tsx

"use client"

import clsx from "clsx"

type ProgressBarSize = "sm" | "md" | "lg"

interface ProgressBarProps {
  percent: number
  color?: string
  size?: ProgressBarSize
  /** Show the percentage as text inside the bar (only visible on lg size) */
  showLabel?: boolean
  animated?: boolean
  className?: string
}

const sizeMap: Record<ProgressBarSize, { track: string; fill: string }> = {
  sm: { track: "p-px", fill: "h-1.5" },
  md: { track: "p-1", fill: "h-3" },
  lg: { track: "p-2", fill: "h-3" },
}

function ProgressBar({
  percent,
  color,
  size = "md",
  showLabel = false,
  animated = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const { track, fill } = sizeMap[size]
  const resolvedColor = color ?? "var(--color-accent)"

  return (
    <div className={clsx("nm-inset-sm rounded-nm-pill overflow-hidden", track, className)}>
      <div
        className={clsx(
          "nm-raised-sm rounded-nm-pill relative",
          fill,
          animated && "transition-all duration-300",
          clamped === 0 && "invisible"
        )}
        style={{
          width: `${clamped}%`,
          backgroundColor: resolvedColor,
          filter: clamped > 0 ? `drop-shadow(0 0 8px ${resolvedColor}60)` : undefined,
        }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {showLabel && size === "lg" && clamped > 10 && (
          <span className="absolute inset-0 flex items-center justify-center text-4xs font-mono font-semibold text-white/80">
            {Math.round(clamped)}%
          </span>
        )}
      </div>
    </div>
  )
}

export type { ProgressBarProps, ProgressBarSize }
export { ProgressBar }
