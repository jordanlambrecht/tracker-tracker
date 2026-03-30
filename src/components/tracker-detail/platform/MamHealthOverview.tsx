// src/components/tracker-detail/platform/MamHealthOverview.tsx

import { SlotLabel } from "@typography"
import { InfoTip } from "@/components/ui/InfoTip"
import { Notice } from "@/components/ui/Notice"
import { ProgressWidget } from "@/components/ui/ProgressWidget"
import { MAM_BONUS_CAP } from "@/lib/adapters/constants"
import type { MamPlatformMeta } from "@/lib/adapters/types"
import { formatCount } from "@/lib/formatters"

export interface MamHealthOverviewProps {
  meta: MamPlatformMeta
  seedingCount: number
  leechingCount: number
  hitAndRuns: number
  seedbonus: number | null
  accentColor: string
  vipUntil: string | null
  unsatisfiedCount: number | null
  unsatisfiedLimit: number | null
}

const ESTIMATED_POINTS_PER_SEED_PER_HOUR = 0.5 // Rough average

// ── Torrent health segments ─────────────────────────────────────────────────
const SEGMENTS = [
  { key: "seeding", label: "Seeding", color: "var(--color-success)" },
  { key: "seedingHnr", label: "Seeding HnR", color: "var(--color-warn)" },
  { key: "leeching", label: "Leeching", color: "var(--color-accent)" },
  { key: "inactiveHnr", label: "Inactive HnR", color: "var(--color-danger)" },
  { key: "preHnr", label: "Pre-HnR", color: "var(--color-warn)" },
  { key: "completed", label: "Completed", color: "var(--color-tertiary)" },
] as const

export function MamHealthOverview({
  meta,
  seedingCount,
  leechingCount,
  hitAndRuns,
  seedbonus,
  accentColor,
  vipUntil,
  unsatisfiedCount,
  unsatisfiedLimit,
}: MamHealthOverviewProps) {
  // ── VIP countdown data ──────────────────────────────────────────────────
  let vipDays: number | null = null
  let vipPct = 0
  let vipColor = accentColor
  let vipDateStr = ""
  if (vipUntil) {
    const expiry = new Date(vipUntil)
    if (!Number.isNaN(expiry.getTime())) {
      const ms = expiry.getTime() - Date.now()
      if (ms > 0) {
        vipDays = Math.ceil(ms / (1000 * 60 * 60 * 24))
        vipPct = (vipDays / 90) * 100
        if (vipDays <= 3) vipColor = "var(--color-danger)"
        else if (vipDays <= 7) vipColor = "var(--color-warn)"
        vipDateStr = expiry.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      }
    }
  }

  // ── Satisfaction data ───────────────────────────────────────────────────
  const safeLimit = unsatisfiedLimit ?? 0
  const hasCapacity = safeLimit > 0
  const satUsed = hasCapacity ? Math.min(unsatisfiedCount ?? 0, safeLimit) : 0
  const satPct = hasCapacity ? (satUsed / safeLimit) * 100 : 0
  const satRemaining = hasCapacity ? safeLimit - satUsed : 0
  let satColor = accentColor
  if (satPct >= 90) satColor = "var(--color-danger)"
  else if (satPct >= 70) satColor = "var(--color-warn)"

  // ── Torrent health data ────────────────────────────────────────────────
  const healthValues: Record<string, number> = {
    seeding: Math.max(0, seedingCount - (meta.seedingHnrCount ?? 0)),
    seedingHnr: meta.seedingHnrCount ?? 0,
    leeching: leechingCount,
    inactiveHnr: hitAndRuns,
    preHnr: meta.inactiveUnsatisfiedCount ?? 0,
    completed: meta.inactiveSatisfiedCount ?? 0,
  }
  const healthTotal = Object.values(healthValues).reduce((a, b) => a + b, 0)

  // ── Bonus cap data ─────────────────────────────────────────────────────
  const atCap = seedbonus != null && seedbonus >= MAM_BONUS_CAP
  const wastePerDay = atCap ? Math.round(seedingCount * ESTIMATED_POINTS_PER_SEED_PER_HOUR * 24) : 0

  const hasVip = vipDays != null
  const hasHealth = healthTotal > 0

  // Nothing to show
  if (!hasVip && !hasCapacity && !hasHealth && !atCap) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* ── Top-left: VIP Countdown ──────────────────────────────────────── */}
      {hasVip && (
        <ProgressWidget
          inset
          label="VIP Expires"
          value={`${vipDays}d`}
          percent={vipPct}
          color={vipColor}
          footer={vipDateStr}
        />
      )}

      {/* ── Top-right: Download Capacity ─────────────────────────────────── */}
      {hasCapacity && (
        <ProgressWidget
          inset
          label="Download Capacity"
          value={`${satRemaining} / ${unsatisfiedLimit} slots`}
          percent={satPct}
          color={satColor}
          footer={`${satUsed} unsatisfied torrent${satUsed !== 1 ? "s" : ""}`}
        />
      )}

      {/* ── Bottom-left: Torrent Health ──────────────────────────────────── */}
      {hasHealth && (
        <div className="nm-inset-sm bg-control-bg rounded-nm-md p-4 flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <SlotLabel label="Torrent Health" />
            <InfoTip
              content="Breakdown of your snatched torrents by seeding status. Green = seeding and satisfied. Amber = seeding but not yet past the 72-hour requirement (pre-HnR or active HnR). Red = not seeding past deadline (Hit & Run). Gray = completed, no longer seeding."
              size="sm"
            />
          </div>
          <div className="nm-inset h-3 w-full overflow-hidden rounded-nm-pill flex">
            {SEGMENTS.map(({ key, label, color }) => {
              const pct = (healthValues[key] / healthTotal) * 100
              if (pct <= 0) return null
              return (
                <div
                  key={key}
                  className="h-full first:rounded-l-nm-pill last:rounded-r-nm-pill"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                  title={`${label}: ${healthValues[key]}`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {SEGMENTS.map(({ key, label, color }) => {
              if (healthValues[key] <= 0) return null
              return (
                <span key={key} className="timestamp flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: color }}
                  />
                  {label}: {formatCount(healthValues[key])}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bottom-right: Bonus Cap Warning ──────────────────────────────── */}
      {atCap && (
        <div className="nm-inset-sm bg-danger-dim rounded-nm-md p-4 flex flex-col gap-1">
          <SlotLabel label="Bonus Cap Reached" className="text-danger" />
          <span className="text-sm font-mono font-semibold text-primary">
            {formatCount(seedbonus ?? 0)} / {formatCount(MAM_BONUS_CAP)}
          </span>
          {wastePerDay > 0 && (
            <Notice variant="warn" message={`~${formatCount(wastePerDay)} pts/day wasted`} />
          )}
        </div>
      )}
    </div>
  )
}
