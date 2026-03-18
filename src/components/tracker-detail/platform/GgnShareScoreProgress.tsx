// src/components/tracker-detail/platform/GgnShareScoreProgress.tsx

import { hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"

export interface GgnShareScoreProgressProps {
  latestSnapshot: Snapshot | null
  accentColor: string
}

export function GgnShareScoreProgress({ latestSnapshot, accentColor }: GgnShareScoreProgressProps) {
  if (latestSnapshot?.shareScore == null) return null

  const score = latestSnapshot.shareScore
  const maxScore = 15
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-tertiary uppercase tracking-wider font-sans font-medium text-[10px]">
          Share Score
        </span>
        <span className="text-secondary font-semibold">
          {score.toFixed(2)} / {maxScore}
        </span>
      </div>
      <div className="nm-inset h-2 w-full overflow-hidden rounded-nm-pill">
        <div
          className="h-full transition-all duration-500 rounded-nm-pill"
          style={{
            width: `${pct}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${hexToRgba(accentColor, 0.5)}`,
          }}
        />
      </div>
    </div>
  )
}
