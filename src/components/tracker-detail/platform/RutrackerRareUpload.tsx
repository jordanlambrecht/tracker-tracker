// src/components/tracker-detail/platform/RutrackerRareUpload.tsx
//
// Functions: topBonusProgress, RutrackerRareUpload

import { ProgressWidget } from "@/components/ui/ProgressWidget"
import { formatBytesNum } from "@/lib/formatters"
import type { RuTrackerPlatformMeta } from "@/types/tracker-stats"

const GiB = 2 ** 30

/**
 * Top Bonus levels by upload on rare torrents, in the binary units RuTracker
 * prints as GB. Level 01 (300 GB) is the official entry threshold; the rest
 * are rutracker.wiki's.
 */
export const TOP_BONUS_LEVELS: readonly number[] = [
  300,
  500,
  1024,
  3 * 1024,
  10 * 1024,
  50 * 1024,
  100 * 1024,
  200 * 1024,
  500 * 1024,
  1024 ** 2,
  3 * 1024 ** 2,
].map((gib) => gib * GiB)

export interface TopBonusProgress {
  /** Levels reached, 0 below the entry threshold */
  level: number
  /** The next threshold, or null once the last level is reached */
  nextThreshold: number | null
  /** Share of the way from the current level's threshold to the next one */
  percent: number
}

export function topBonusProgress(rareBytes: number): TopBonusProgress {
  const level = TOP_BONUS_LEVELS.filter((threshold) => rareBytes >= threshold).length
  if (level === TOP_BONUS_LEVELS.length) return { level, nextThreshold: null, percent: 100 }
  const from = level === 0 ? 0 : TOP_BONUS_LEVELS[level - 1]
  const to = TOP_BONUS_LEVELS[level]
  return { level, nextThreshold: to, percent: ((rareBytes - from) / (to - from)) * 100 }
}

const levelName = (level: number) => `Top Bonus ${String(level).padStart(2, "0")}`

export interface RutrackerRareUploadProps {
  meta: RuTrackerPlatformMeta
  accentColor: string
}

export function RutrackerRareUpload({ meta, accentColor }: RutrackerRareUploadProps) {
  const rare = meta.rareUploadedBytes
  if (rare === undefined) return null
  const progress = topBonusProgress(rare)
  const days = [
    meta.rareUploadedTodayBytes !== undefined &&
      `Today ${formatBytesNum(meta.rareUploadedTodayBytes)}`,
    meta.rareUploadedYesterdayBytes !== undefined &&
      `Yesterday ${formatBytesNum(meta.rareUploadedYesterdayBytes)}`,
  ].filter(Boolean)

  return (
    <div className="bg-raised p-5 flex flex-col gap-3 nm-raised-sm rounded-nm-lg">
      <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
        Uploaded on Rare
      </p>
      <span className="font-mono text-2xl font-semibold text-primary leading-none tabular-nums">
        {formatBytesNum(rare)}
      </span>
      {days.length > 0 && <p className="font-mono text-xs text-muted">{days.join(" · ")}</p>}
      <ProgressWidget
        label={levelName(progress.nextThreshold === null ? progress.level : progress.level + 1)}
        value={
          progress.nextThreshold === null
            ? "Reached"
            : `${formatBytesNum(rare)} / ${formatBytesNum(progress.nextThreshold)}`
        }
        percent={progress.percent}
        color={accentColor}
        footer={progress.level > 0 ? `${levelName(progress.level)} reached` : undefined}
      />
    </div>
  )
}
