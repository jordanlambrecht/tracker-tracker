// src/components/tracker-detail/platform/GgnStatCards.tsx

import { ShareScoreIcon } from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import type { Snapshot } from "@/types/api"

interface GgnStatCardsProps {
  platformType: string
  latestSnapshot: Snapshot | null
  accentColor: string
}

export function GgnStatCards({ platformType, latestSnapshot, accentColor }: GgnStatCardsProps) {
  if (platformType !== "ggn") return null

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      <StatCard
        label="Share Score"
        value={latestSnapshot?.shareScore != null ? latestSnapshot.shareScore.toFixed(2) : "—"}
        unit={latestSnapshot?.shareScore != null ? "/ 15" : undefined}
        accentColor={accentColor}
        icon={<ShareScoreIcon width="16" height="16" />}
      />
    </div>
  )
}
