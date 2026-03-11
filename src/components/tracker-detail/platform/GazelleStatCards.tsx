// src/components/tracker-detail/platform/GazelleStatCards.tsx

import { DownloadArrowIcon, ShieldIcon, StarIcon, UploadArrowIcon, UserIcon } from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import type { GazellePlatformMeta } from "@/types/api"

interface GazelleStatCardsProps {
  gazelleMeta: GazellePlatformMeta | null
  accentColor: string
}

export function GazelleStatCards({ gazelleMeta, accentColor }: GazelleStatCardsProps) {
  if (!gazelleMeta) return null

  const community = gazelleMeta.community ?? null
  const hasEnrichment = gazelleMeta.giftTokens != null || gazelleMeta.meritTokens != null || community != null

  return (
    <>
      {hasEnrichment && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {gazelleMeta.giftTokens != null && (
            <StatCard label="FL Tokens" value={gazelleMeta.giftTokens.toLocaleString()} accentColor={accentColor} icon={<StarIcon width="16" height="16" />} />
          )}
          {gazelleMeta.meritTokens != null && (
            <StatCard label="Merit Tokens" value={gazelleMeta.meritTokens.toLocaleString()} accentColor={accentColor} icon={<ShieldIcon width="16" height="16" />} />
          )}
          {community?.perfectFlacs != null && community.perfectFlacs > 0 && (
            <StatCard label="Perfect FLACs" value={community.perfectFlacs.toLocaleString()} accentColor={accentColor} icon={<UploadArrowIcon width="16" height="16" />} />
          )}
          {community?.snatched != null && (
            <StatCard label="Snatched" value={community.snatched.toLocaleString()} accentColor={accentColor} icon={<DownloadArrowIcon width="16" height="16" />} />
          )}
        </div>
      )}
      {community != null && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {community.uploaded > 0 && (
            <StatCard label="Torrents Uploaded" value={community.uploaded.toLocaleString()} accentColor={accentColor} icon={<UploadArrowIcon width="16" height="16" />} />
          )}
          {community.requestsFilled > 0 && (
            <StatCard label="Requests Filled" value={community.requestsFilled.toLocaleString()} accentColor={accentColor} icon={<UploadArrowIcon width="16" height="16" />} />
          )}
          {community.groups > 0 && (
            <StatCard label="Groups" value={community.groups.toLocaleString()} accentColor={accentColor} icon={<ShieldIcon width="16" height="16" />} />
          )}
          {community.invited > 0 && (
            <StatCard label="Invited" value={community.invited.toLocaleString()} accentColor={accentColor} icon={<UserIcon width="16" height="16" />} />
          )}
        </div>
      )}
    </>
  )
}
