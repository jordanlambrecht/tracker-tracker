// src/components/tracker-detail/platform/V3xLevelProgress.tsx

import { ProgressBar } from "@/components/ui/ProgressBar"
import { V3X_MAX_LEVEL, v3xClassName, xpToReach } from "@/data/v3x-levels"
import { formatCount } from "@/lib/formatters"

export interface V3xLevelProgressProps {
  level: number
  xp: number
  prestige: number
  accentColor: string
}

/** XP through the current level, from the cumulative XP and the site's level formula. */
export function V3xLevelProgress({ level, xp, prestige, accentColor }: V3xLevelProgressProps) {
  const current = v3xClassName(level) ?? `N${level}`
  const stars = prestige > 0 ? ` ${"★".repeat(Math.min(prestige, 5))}` : ""

  if (level >= V3X_MAX_LEVEL) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-secondary font-semibold">
            {current}
            {stars}
          </span>
          <span className="text-tertiary">{formatCount(xp)} XP</span>
        </div>
        <ProgressBar percent={100} color={accentColor} size="sm" />
        <p className="timestamp text-right">Top level, prestige available</p>
      </div>
    )
  }

  const start = xpToReach(level)
  const end = xpToReach(level + 1)
  const into = Math.max(0, xp - start)
  const need = end - start
  const next = v3xClassName(level + 1) ?? `N${level + 1}`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-secondary font-semibold">
          {current}
          {stars}
        </span>
        <span className="text-tertiary">
          {formatCount(into)} / {formatCount(need)} XP
        </span>
        <span className="text-muted">{next}</span>
      </div>
      <ProgressBar percent={Math.min(100, (into / need) * 100)} color={accentColor} size="sm" />
      <p className="timestamp text-right">
        {formatCount(Math.max(0, end - xp))} XP to {next}
      </p>
    </div>
  )
}
