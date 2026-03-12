// src/components/tracker-detail/platform/GgnAchievementProgress.tsx

import { hexToRgba } from "@/lib/formatters"
import type { GGnPlatformMeta } from "@/types/api"

interface GgnAchievementProgressProps {
  ggMeta: GGnPlatformMeta | null
  accentColor: string
}

export function GgnAchievementProgress({ ggMeta, accentColor }: GgnAchievementProgressProps) {
  if (!ggMeta?.achievements) return null

  const { userLevel, nextLevel, totalPoints, pointsToNextLvl } = ggMeta.achievements
  const earned = totalPoints - pointsToNextLvl
  const pct = totalPoints > 0 ? Math.min(100, Math.max(0, (earned / totalPoints) * 100)) : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-secondary font-semibold">{userLevel}</span>
        <span className="text-tertiary">
          {earned.toLocaleString()} / {totalPoints.toLocaleString()} pts
        </span>
        <span className="text-muted">{nextLevel}</span>
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
      <p className="text-[10px] font-mono text-muted text-right">
        {pointsToNextLvl.toLocaleString()} pts to {nextLevel}
      </p>
    </div>
  )
}
