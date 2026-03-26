// src/components/tracker-detail/platform/GgnAchievementProgress.tsx

import { ProgressBar } from "@/components/ui/ProgressBar"
import type { GGnPlatformMeta } from "@/types/api"

export interface GgnAchievementProgressProps {
  ggMeta: GGnPlatformMeta | null
  accentColor: string
}

export function GgnAchievementProgress({ ggMeta, accentColor }: GgnAchievementProgressProps) {
  if (!ggMeta?.achievements) return null

  const { userLevel, nextLevel, totalPoints, pointsToNextLvl } = ggMeta.achievements
  const earned = totalPoints - pointsToNextLvl
  const pct = totalPoints > 0 ? (earned / totalPoints) * 100 : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-secondary font-semibold">{userLevel}</span>
        <span className="text-tertiary">
          {earned.toLocaleString()} / {totalPoints.toLocaleString()} pts
        </span>
        <span className="text-muted">{nextLevel}</span>
      </div>
      <ProgressBar percent={pct} color={accentColor} size="sm" />
      <p className="text-[10px] font-mono text-muted text-right">
        {pointsToNextLvl.toLocaleString()} pts to {nextLevel}
      </p>
    </div>
  )
}
