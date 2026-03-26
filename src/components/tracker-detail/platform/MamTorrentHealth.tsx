// src/components/tracker-detail/platform/MamTorrentHealth.tsx

import type { MamPlatformMeta } from "@/lib/adapters/types"

export interface MamTorrentHealthProps {
  meta: MamPlatformMeta
  seedingCount: number
  leechingCount: number
  hitAndRuns: number
}

const SEGMENTS = [
  { key: "seeding", label: "Seeding", color: "var(--color-success)" },
  { key: "seedingHnr", label: "Seeding HnR", color: "var(--color-warn)" },
  { key: "leeching", label: "Leeching", color: "var(--color-accent)" },
  { key: "inactiveHnr", label: "Inactive HnR", color: "var(--color-danger)" },
  { key: "preHnr", label: "Pre-HnR", color: "var(--color-warn)" },
  { key: "completed", label: "Completed", color: "var(--color-text-tertiary)" },
] as const

export function MamTorrentHealth({ meta, seedingCount, leechingCount, hitAndRuns }: MamTorrentHealthProps) {
  const values: Record<string, number> = {
    seeding: Math.max(0, seedingCount - (meta.seedingHnrCount ?? 0)),
    seedingHnr: meta.seedingHnrCount ?? 0,
    leeching: leechingCount,
    inactiveHnr: hitAndRuns,
    preHnr: meta.inactiveUnsatisfiedCount ?? 0,
    completed: meta.inactiveSatisfiedCount ?? 0,
  }

  const total = Object.values(values).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <span className="slot-label">Torrent Health</span>
      <div className="nm-inset h-3 w-full overflow-hidden rounded-nm-pill flex">
        {SEGMENTS.map(({ key, label, color }) => {
          const pct = (values[key] / total) * 100
          if (pct <= 0) return null
          return (
            <div
              key={key}
              className="h-full first:rounded-l-nm-pill last:rounded-r-nm-pill"
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${label}: ${values[key]}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {SEGMENTS.map(({ key, label, color }) => {
          if (values[key] <= 0) return null
          return (
            <span key={key} className="text-[10px] font-mono text-muted flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: color }}
              />
              {label}: {values[key].toLocaleString()}
            </span>
          )
        })}
      </div>
    </div>
  )
}
