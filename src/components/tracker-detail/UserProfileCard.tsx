// src/components/tracker-detail/UserProfileCard.tsx

import { RankTooltip } from "@/components/tracker-detail/RankTooltip"
import { TrackerAvatar } from "@/components/tracker-detail/TrackerAvatar"
import { Badge } from "@/components/ui/Badge"
import { UserIcon } from "@/components/ui/Icons"
import { RedactedText } from "@/components/ui/RedactedText"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/color-utils"
import { formatAccountAge, formatJoinedDate } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import type { TrackerAccountOverview, TrackerSummary } from "@/types/api"

interface UserProfileCardProps {
  tracker: TrackerSummary
  /** The latest snapshot, or the overview of a tracker that reports no stats */
  account: TrackerAccountOverview
  registryEntry: TrackerRegistryEntry | undefined
  accentColor: string
}

export function UserProfileCard({
  tracker,
  account,
  registryEntry,
  accentColor: tc,
}: UserProfileCardProps) {
  if (!account.username && !account.group) return null

  const accountAge = formatAccountAge(tracker.joinedAt)
  const joinedDate = formatJoinedDate(tracker.joinedAt)

  return (
    <div className="nm-raised bg-elevated px-4 sm:px-6 py-5 w-full sm:w-fit rounded-nm-lg">
      <div className="flex items-center gap-6">
        <div className="flex items-center justify-center w-14 h-14 nm-inset-sm bg-control-bg shrink-0 overflow-hidden rounded-nm-pill">
          {tracker.remoteUserId ? (
            <TrackerAvatar trackerId={tracker.id} accentColor={tc} />
          ) : (
            <UserIcon width="24" height="24" stroke={tc} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {account.username && (
            <RedactedText
              value={account.username}
              color={tc}
              className="text-lg font-mono text-primary font-semibold"
            />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {account.group && registryEntry?.userClasses && !isRedacted(account.group) ? (
              <RankTooltip
                currentRank={account.group}
                userClasses={registryEntry.userClasses}
                accentColor={tc}
              />
            ) : account.group ? (
              <Badge style={{ backgroundColor: hexToRgba(tc, 0.15), color: tc }}>
                <RedactedText value={account.group} color={tc} />
              </Badge>
            ) : null}
          </div>
          {(joinedDate || accountAge) && (
            <div className="flex items-center gap-1">
              {joinedDate && (
                <span className="text-xs font-mono text-muted">Joined {joinedDate}</span>
              )}
              {joinedDate && accountAge && <span className="text-xs font-mono text-muted">·</span>}
              {accountAge && <span className="text-xs font-mono text-muted">{accountAge}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
