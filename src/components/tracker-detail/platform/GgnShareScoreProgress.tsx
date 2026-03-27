// src/components/tracker-detail/platform/GgnShareScoreProgress.tsx

import { ProgressBar } from "@/components/ui/ProgressBar"
import type { Snapshot } from "@/types/api"

export interface GgnShareScoreProgressProps {
  latestSnapshot: Snapshot | null
  accentColor: string
}

export function GgnShareScoreProgress({ latestSnapshot, accentColor }: GgnShareScoreProgressProps) {
  if (latestSnapshot?.shareScore == null) return null

  const score = latestSnapshot.shareScore
  const maxScore = 15
  const pct = (score / maxScore) * 100

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="slot-label">Share Score</span>
        <span className="text-secondary font-semibold">
          {score.toFixed(2)} / {maxScore}
        </span>
      </div>
      <ProgressBar percent={pct} color={accentColor} size="sm" />
    </div>
  )
}
