// src/components/dashboard/TrackerBreakdownTicker.tsx
"use client"

import { compareBigIntDesc } from "@/lib/data-transforms"
import { formatBytesFromString } from "@/lib/formatters"
import type { TodayAtAGlance } from "@/types/api"

interface TrackerBreakdownProps {
  trackers: TodayAtAGlance["trackers"]
}

export function TrackerBreakdownTicker({ trackers }: TrackerBreakdownProps) {
  const active = [...trackers]
    .filter((t) => BigInt(t.uploadDelta) > 0n)
    .sort((a, b) => compareBigIntDesc(BigInt(a.uploadDelta), BigInt(b.uploadDelta)))

  if (active.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((tracker) => {
        const dotColor = tracker.color ?? "var(--color-accent)"

        return (
          <div
            key={tracker.id}
            className="nm-raised-sm rounded-full px-3 py-1 flex items-center gap-2"
          >
            <span className="color-dot" style={{ backgroundColor: dotColor }} />
            <span className="text-xs font-sans text-primary">{tracker.name}</span>
            <span className="text-xs font-mono text-secondary">
              {formatBytesFromString(tracker.uploadDelta)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
