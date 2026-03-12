// src/components/dashboard/torrents/TorrentStatCards.tsx

"use client"

import { CHART_THEME } from "@/components/charts/theme"
import { BoltIcon, BoxIcon, ClockIcon, LeechingIcon, SeedingIcon, ShareScoreIcon, TriangleWarningIcon } from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import { formatBytesFromNumber, formatDuration, splitValueUnit } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

const ICONS = {
  seeding: <SeedingIcon width={16} height={16} />,
  leeching: <LeechingIcon width={16} height={16} />,
  warning: <TriangleWarningIcon width={16} height={16} />,
  crossSeed: <ShareScoreIcon width={16} height={16} />,
  speed: <BoltIcon width={16} height={16} />,
  stale: <ClockIcon width={16} height={16} />,
  size: <BoxIcon width={16} height={16} />,
}

interface TorrentStatCardsProps {
  torrents: TorrentInfo[]
  seedingTorrents: TorrentInfo[]
  leechingTorrents: TorrentInfo[]
  totalUpSpeed: number
  totalSize: number
  crossSeededCount: number
  deadCount: number | null
  trackerSeedingCount: number | null
  unsatisfiedCount: number | null
  requiredSeedSeconds: number | null
  accentColor: string
}

export function TorrentStatCards({
  torrents,
  seedingTorrents,
  leechingTorrents,
  totalUpSpeed,
  totalSize,
  crossSeededCount,
  deadCount,
  trackerSeedingCount,
  unsatisfiedCount,
  accentColor,
}: TorrentStatCardsProps) {
  const uploadSpeedFormatted = `${formatBytesFromNumber(totalUpSpeed)}/s`
  const uploadSpeedParts = splitValueUnit(uploadSpeedFormatted)
  const totalSizeParts = splitValueUnit(formatBytesFromNumber(totalSize))

  const avgSeedTimeValue = torrents.length > 0
    ? formatDuration(Math.floor(torrents.reduce((s, t) => s + t.seedingTime, 0) / torrents.length))
    : "—"

  const avgSizeParts = torrents.length > 0
    ? splitValueUnit(formatBytesFromNumber(Math.floor(totalSize / torrents.length)))
    : null

  const largestParts = torrents.length > 0
    ? splitValueUnit(formatBytesFromNumber(Math.max(...torrents.map((t) => t.size))))
    : null

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <StatCard label="Seeding" value={seedingTorrents.length.toLocaleString()} accentColor={accentColor} icon={ICONS.seeding} />
      <StatCard label="Leeching" value={leechingTorrents.length.toLocaleString()} accentColor={accentColor} icon={ICONS.leeching} />
      <StatCard label="Upload Speed" value={uploadSpeedParts.num} unit={uploadSpeedParts.unit} accentColor={accentColor} icon={ICONS.speed} />
      <StatCard label="Total Size" value={totalSizeParts.num} unit={totalSizeParts.unit} accentColor={accentColor} icon={ICONS.size} />
      <StatCard label="Cross-Seeded" value={crossSeededCount.toLocaleString()} unit={`/ ${torrents.length.toLocaleString()}`} accentColor={accentColor} icon={ICONS.crossSeed} />
      {deadCount !== null && (
        <StatCard
          label="Dead"
          value={deadCount.toLocaleString()}
          accentColor={deadCount > 0 ? CHART_THEME.warn : accentColor}
          icon={ICONS.warning}
          tooltip={`Client has ${seedingTorrents.length} seeding torrents, tracker reports ${trackerSeedingCount?.toLocaleString() ?? "?"}. Difference may include torrents removed from the tracker but still in your client. This is an estimate and may not be accurate if the tracker's seeding count is affected by paranoia settings or API delays.`}
        />
      )}
      <StatCard
        label="Avg Seed Time"
        value={avgSeedTimeValue}
        accentColor={accentColor}
        icon={ICONS.seeding}
      />
      <StatCard label="Avg Size" value={avgSizeParts?.num ?? "—"} unit={avgSizeParts?.unit} accentColor={accentColor} icon={ICONS.size} />
      <StatCard label="Largest" value={largestParts?.num ?? "—"} unit={largestParts?.unit} accentColor={accentColor} icon={ICONS.size} />
      {unsatisfiedCount !== null && (
        <StatCard label="H&R Risk" value={unsatisfiedCount.toLocaleString()} accentColor={unsatisfiedCount > 0 ? CHART_THEME.danger : accentColor} icon={ICONS.warning} />
      )}
    </div>
  )
}
