// src/components/dashboard/torrents/TorrentStatCards.tsx
"use client"

import { CHART_THEME } from "@/components/charts/lib/theme"
import {
  BoxIcon,
  ClockIcon,
  SeedingIcon,
  ShareScoreIcon,
  TriangleWarningIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import type { TorrentRaw } from "@/lib/fleet"
import { formatBytesNum, formatCount, formatDuration, splitValueUnit } from "@/lib/formatters"

const ICONS = {
  seeding: <SeedingIcon width={16} height={16} />,
  warning: <TriangleWarningIcon width={16} height={16} />,
  crossSeed: <ShareScoreIcon width={16} height={16} />,
  stale: <ClockIcon width={16} height={16} />,
  size: <BoxIcon width={16} height={16} />,
}

interface TorrentStatCardsProps {
  torrents: TorrentRaw[]
  seedingTorrents: TorrentRaw[]
  totalSize: number
  crossSeededCount: number
  deadCount: number | null
  trackerSeedingCount: number | null
  unsatisfiedCount: number | null
  hnrRiskCount: number | null
  accentColor: string
  clientCount: number
}

export function TorrentStatCards({
  torrents,
  seedingTorrents,
  totalSize,
  crossSeededCount,
  deadCount,
  trackerSeedingCount,
  unsatisfiedCount,
  hnrRiskCount,
  accentColor,
  clientCount,
}: TorrentStatCardsProps) {
  const totalSizeParts = splitValueUnit(formatBytesNum(totalSize))

  const avgSeedTimeValue =
    torrents.length > 0
      ? formatDuration(
          Math.floor(torrents.reduce((s, t) => s + t.seedingTime, 0) / torrents.length)
        )
      : "—"

  const avgSizeParts =
    torrents.length > 0
      ? splitValueUnit(formatBytesNum(Math.floor(totalSize / torrents.length)))
      : null

  const largestParts =
    torrents.length > 0
      ? splitValueUnit(formatBytesNum(Math.max(...torrents.map((t) => t.size))))
      : null

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 auto-rows-fr">
      {clientCount > 1 ? (
        <StatCard
          type="stacked"
          title="Seeding"
          icon={ICONS.seeding}
          accentColor={accentColor}
          sumIsHero
          className="row-span-2"
          total={{ label: "Total", value: formatCount(seedingTorrents.length) }}
          rows={(() => {
            const byClient = new Map<string, number>()
            for (const t of seedingTorrents) {
              const names = (t.clientName || "Unknown").split(",").map((s) => s.trim())
              for (const name of names) {
                byClient.set(name, (byClient.get(name) ?? 0) + 1)
              }
            }
            return [...byClient.entries()].map(([label, count]) => ({
              label,
              value: formatCount(count),
            }))
          })()}
        />
      ) : (
        <StatCard
          label="Seeding"
          value={formatCount(seedingTorrents.length)}
          accentColor={accentColor}
          icon={ICONS.seeding}
        />
      )}
      {clientCount > 1 ? (
        <StatCard
          type="stacked"
          title="Total Size"
          icon={ICONS.size}
          accentColor={accentColor}
          sumIsHero
          className="row-span-2"
          total={{ label: "Total", value: totalSizeParts.num, unit: totalSizeParts.unit }}
          rows={(() => {
            const byClient = new Map<string, number>()
            for (const t of torrents) {
              const names = (t.clientName || "Unknown").split(",").map((s) => s.trim())
              for (const name of names) {
                byClient.set(name, (byClient.get(name) ?? 0) + t.size)
              }
            }
            return [...byClient.entries()].map(([label, bytes]) => {
              const parts = splitValueUnit(formatBytesNum(bytes))
              return { label, value: parts.num, unit: parts.unit }
            })
          })()}
        />
      ) : (
        <StatCard
          label="Total Size"
          value={totalSizeParts.num}
          unit={totalSizeParts.unit}
          accentColor={accentColor}
          icon={ICONS.size}
        />
      )}
      <StatCard
        label="Cross-Seeded"
        value={formatCount(crossSeededCount)}
        unit={`/ ${formatCount(torrents.length)}`}
        accentColor={accentColor}
        icon={ICONS.crossSeed}
      />
      {deadCount !== null && (
        <StatCard
          label="Dead"
          value={formatCount(deadCount)}
          accentColor={deadCount > 0 ? CHART_THEME.warn : accentColor}
          icon={ICONS.warning}
          tooltip={`Client has ${seedingTorrents.length} seeding torrents, tracker reports ${trackerSeedingCount != null ? formatCount(trackerSeedingCount) : "?"}. Difference may include torrents removed from the tracker but still in your client. This is an estimate and may not be accurate if the tracker's seeding count is affected by paranoia settings or API delays.`}
        />
      )}
      <StatCard
        label="Avg Seed Time"
        value={avgSeedTimeValue}
        accentColor={accentColor}
        icon={ICONS.seeding}
      />
      <StatCard
        label="Avg Size"
        value={avgSizeParts?.num ?? "—"}
        unit={avgSizeParts?.unit}
        accentColor={accentColor}
        icon={ICONS.size}
      />
      <StatCard
        label="Largest"
        value={largestParts?.num ?? "—"}
        unit={largestParts?.unit}
        accentColor={accentColor}
        icon={ICONS.size}
      />
      {hnrRiskCount !== null && (
        <StatCard
          label="H&R Risk"
          value={formatCount(hnrRiskCount)}
          accentColor={hnrRiskCount > 0 ? CHART_THEME.danger : accentColor}
          icon={ICONS.warning}
          tooltip={
            unsatisfiedCount != null
              ? `${unsatisfiedCount} unsatisfied total, ${hnrRiskCount} stopped/paused (actual risk)`
              : undefined
          }
        />
      )}
    </div>
  )
}
