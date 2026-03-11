// src/components/dashboard/EcosystemStatusBar.tsx
//
// Functions: EcosystemStatusBar

"use client"

import { useRouter } from "next/navigation"
import { PulseDot } from "@/components/ui/PulseDot"
import { formatRatio } from "@/lib/formatters"
import { getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

interface EcosystemStatusBarProps {
  trackers: TrackerSummary[]
}

function EcosystemStatusBar({ trackers }: EcosystemStatusBarProps) {
  const router = useRouter()

  if (trackers.length === 0) return null

  return (
    <div className="flex flex-wrap gap-3">
      {trackers.map((t) => {
        const health = getTrackerHealth(t)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => router.push(`/trackers/${t.id}`)}
            className="flex items-center gap-2.5 px-4 py-3 nm-raised-sm cursor-pointer transition-all duration-150 hover:nm-raised rounded-nm-md"
            style={{ borderLeft: `3px solid ${t.color}` }}
          >
            <PulseDot status={getHealthPulseDot(health)} size="sm" color={health === "healthy" ? t.color : undefined} />
            <span className="font-sans text-sm font-semibold text-primary whitespace-nowrap">
              {t.name}
            </span>
            <span className="font-mono text-xs text-tertiary tabular-nums">
              {t.latestStats?.ratio != null ? `${formatRatio(t.latestStats.ratio)}×` : "—"}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { EcosystemStatusBar }
