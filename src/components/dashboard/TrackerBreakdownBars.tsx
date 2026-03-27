// src/components/dashboard/TrackerBreakdownBars.tsx

"use client"

import { ProgressBar } from "@/components/ui/ProgressBar"
import { compareBigIntDesc, formatBytesFromString } from "@/lib/formatters"
import type { TodayAtAGlance } from "@/types/api"

interface TrackerBreakdownProps {
  trackers: TodayAtAGlance["trackers"]
  metric?: "upload" | "download"
}

const TOP_N = 5

export function TrackerBreakdownBars({ trackers, metric = "upload" }: TrackerBreakdownProps) {
  if (trackers.length === 0) return null

  const getDelta = (t: TodayAtAGlance["trackers"][number]) =>
    metric === "upload" ? t.uploadDelta : t.downloadDelta

  const sorted = [...trackers].sort((a, b) =>
    compareBigIntDesc(BigInt(getDelta(a)), BigInt(getDelta(b)))
  )

  const top = sorted.slice(0, TOP_N)
  const rest = sorted.slice(TOP_N)

  const othersDelta = rest.reduce((acc, t) => acc + BigInt(getDelta(t)), 0n)
  const totalDelta = sorted.reduce((acc, t) => acc + BigInt(getDelta(t)), 0n)

  const allZero = totalDelta === 0n

  function getPercentage(delta: bigint): number {
    if (totalDelta === 0n) return 0
    return Number((delta * 100n) / totalDelta)
  }

  if (allZero) {
    return (
      <p className="text-xs font-mono text-muted text-center py-2">
        No {metric} activity yet today
      </p>
    )
  }

  const activeTop = top.filter((t) => BigInt(getDelta(t)) > 0n)

  return (
    <div className="flex flex-col gap-2">
      {activeTop.map((tracker) => {
        const delta = BigInt(getDelta(tracker))
        const pct = getPercentage(delta)
        const color = tracker.color ?? undefined

        return (
          <div key={tracker.id} className="flex items-center gap-3">
            <span className="text-xs font-mono text-primary truncate w-28 shrink-0">
              {tracker.name}
            </span>

            <ProgressBar percent={pct} color={color} size="md" className="flex-1" />

            <span className="tabular-cell w-20 text-right shrink-0">
              {formatBytesFromString(getDelta(tracker))}
            </span>
          </div>
        )
      })}

      {othersDelta > 0n && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-tertiary truncate w-28 shrink-0">Others</span>

          <ProgressBar
            percent={getPercentage(othersDelta)}
            color="var(--color-muted)"
            size="md"
            className="flex-1"
          />

          <span className="text-xs font-mono text-tertiary tabular-nums w-20 text-right shrink-0">
            {formatBytesFromString(othersDelta.toString())}
          </span>
        </div>
      )}
    </div>
  )
}
