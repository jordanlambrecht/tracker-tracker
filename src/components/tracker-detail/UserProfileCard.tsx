// src/components/tracker-detail/UserProfileCard.tsx
//
// Functions: UserProfileCard

import { RankTooltip } from "@/components/tracker-detail/RankTooltip"
import { TrackerAvatar } from "@/components/tracker-detail/TrackerAvatar"
import { Badge } from "@/components/ui/Badge"
import { UserIcon } from "@/components/ui/Icons"
import { RedactedText } from "@/components/ui/RedactedText"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { formatAccountAge, formatJoinedDate, hexToRgba } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

interface UserProfileCardProps {
  tracker: TrackerSummary
  stats: TrackerLatestStats
  registryEntry: TrackerRegistryEntry | undefined
  accentColor: string
}

export function UserProfileCard({ tracker, stats, registryEntry, accentColor: tc }: UserProfileCardProps) {
  if (!stats.username && !stats.group) return null

  const accountAge = formatAccountAge(tracker.joinedAt)
  const joinedDate = formatJoinedDate(tracker.joinedAt)

  return (
    <div className="nm-raised bg-elevated px-4 sm:px-6 py-5 w-full sm:w-fit rounded-nm-lg">
      <div className="flex items-center gap-6">
        <div className="flex items-center justify-center w-14 h-14 nm-inset-sm bg-control-bg shrink-0 overflow-hidden rounded-nm-pill">
          {tracker.platformType === "ggn" && tracker.remoteUserId ? (
            <TrackerAvatar trackerId={tracker.id} accentColor={tc} />
          ) : (
            <UserIcon width="24" height="24" stroke={tc} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {stats.username && (
            <RedactedText value={stats.username} color={tc} className="text-lg font-mono text-primary font-semibold" />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {stats.group && registryEntry?.userClasses && !isRedacted(stats.group) ? (
              <RankTooltip currentRank={stats.group} userClasses={registryEntry.userClasses} accentColor={tc} />
            ) : stats.group ? (
              <Badge style={{ backgroundColor: hexToRgba(tc, 0.15), color: tc }}>
                <RedactedText value={stats.group} color={tc} />
              </Badge>
            ) : null}
            {joinedDate && <span className="text-xs font-mono text-muted">Joined {joinedDate}</span>}
            {accountAge && <span className="text-xs font-mono text-muted">· {accountAge}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
