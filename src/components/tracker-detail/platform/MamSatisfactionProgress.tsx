// src/components/tracker-detail/platform/MamSatisfactionProgress.tsx

import { ProgressBar } from "@/components/ui/ProgressBar"

export interface MamSatisfactionProgressProps {
  unsatisfiedCount: number
  unsatisfiedLimit: number
  accentColor: string
}

export function MamSatisfactionProgress({
  unsatisfiedCount,
  unsatisfiedLimit,
  accentColor,
}: MamSatisfactionProgressProps) {
  if (unsatisfiedLimit <= 0) return null

  const used = Math.min(unsatisfiedCount, unsatisfiedLimit)
  const pct = (used / unsatisfiedLimit) * 100
  const remaining = unsatisfiedLimit - used

  let barColor = accentColor
  if (pct >= 90) barColor = "var(--color-danger)"
  else if (pct >= 70) barColor = "var(--color-warn)"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="slot-label">Download Capacity</span>
        <span className="text-secondary font-semibold">
          {remaining} / {unsatisfiedLimit} slots
        </span>
      </div>
      <ProgressBar percent={pct} color={barColor} size="sm" />
      <p className="text-[10px] font-mono text-muted text-right">
        {used} unsatisfied torrent{used !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
