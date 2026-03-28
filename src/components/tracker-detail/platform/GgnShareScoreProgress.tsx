// src/components/tracker-detail/platform/GgnShareScoreProgress.tsx

import { ProgressWidget } from "@/components/ui/ProgressWidget"
import { formatRatio } from "@/lib/formatters"
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
    <ProgressWidget
      label="Share Score"
      value={`${formatRatio(score)} / ${maxScore}`}
      percent={pct}
      color={accentColor}
    />
  )
}
