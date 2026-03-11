// src/components/tracker-detail/TrackerDetailHeader.tsx
//
// Functions: TrackerDetailHeader

import Image from "next/image"
import { TrackerHubStatus } from "@/components/TrackerHubStatus"
import { UserProfileCard } from "@/components/tracker-detail/UserProfileCard"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { ExternalLinkSmallIcon, GearIcon } from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import { H1 } from "@/components/ui/Typography"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { getHealthBadgeVariant, getHealthDescription, getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { GazellePlatformMeta, GGnPlatformMeta, TrackerLatestStats, TrackerSummary } from "@/types/api"

interface TrackerDetailHeaderProps {
  tracker: TrackerSummary
  stats: TrackerLatestStats | null
  registryEntry: TrackerRegistryEntry | undefined
  ggMeta: GGnPlatformMeta | null
  gazelleMeta: GazellePlatformMeta | null
  accentColor: string
  polling: boolean
  onPollNow: () => void
  onOpenSettings: () => void
}

export function TrackerDetailHeader({
  tracker,
  stats,
  registryEntry,
  ggMeta,
  gazelleMeta,
  accentColor: tc,
  polling,
  onPollNow,
  onOpenSettings,
}: TrackerDetailHeaderProps) {
  const health = getTrackerHealth(tracker)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-3">
          {/* Title row */}
          <div className="flex items-center gap-3">
            {registryEntry?.logo && (
              <Image
                src={registryEntry.logo}
                alt=""
                width={24}
                height={24}
                className="shrink-0 object-contain rounded-nm-sm max-h-6"
                aria-hidden="true"
              />
            )}
            <H1 className="text-3xl font-bold tracking-tight">{tracker.name}</H1>
            <PulseDot status={getHealthPulseDot(health)} size="md" />
            <a
              href={tracker.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-accent transition-colors duration-150 shrink-0"
              title={`Open ${tracker.name}`}
            >
              <ExternalLinkSmallIcon width="16" height="16" />
            </a>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getHealthBadgeVariant(health)}>
              {getHealthDescription(health)}
            </Badge>
            <Badge variant="default">{tracker.platformType}</Badge>
            {registryEntry?.language && (
              <Badge variant="default">{registryEntry.language}</Badge>
            )}
            {!tracker.isActive && (
              <Badge variant="warn">Archived</Badge>
            )}
            {/* GGn-specific status badges */}
            {ggMeta && (
              <>
                {ggMeta.donor === true && <Badge variant="accent">Donor</Badge>}
                {stats?.warned === true && <Badge variant="danger">Warned</Badge>}
                {ggMeta.enabled === false && <Badge variant="danger">Disabled</Badge>}
                {ggMeta.parked === true && <Badge variant="warn">Parked</Badge>}
                {ggMeta.invites != null && ggMeta.invites > 0 && (
                  <Badge variant="default">{ggMeta.invites} Invites</Badge>
                )}
                {ggMeta.onIRC === true && (
                  <Badge variant="default">
                    <span className="flex items-center gap-1.5">
                      <PulseDot status="healthy" size="sm" />
                      IRC
                    </span>
                  </Badge>
                )}
              </>
            )}
            {/* Gazelle-specific status badges (RED, OPS, etc.) */}
            {gazelleMeta && (
              <>
                {gazelleMeta.donor === true && <Badge variant="accent">Donor</Badge>}
                {stats?.warned === true && <Badge variant="danger">Warned</Badge>}
                {gazelleMeta.enabled === false && <Badge variant="danger">Disabled</Badge>}
                {gazelleMeta.paranoiaText && gazelleMeta.paranoiaText !== "Off" && (
                  <Badge variant="default">Paranoia: {gazelleMeta.paranoiaText}</Badge>
                )}
                {gazelleMeta.notifications && gazelleMeta.notifications.messages > 0 && (
                  <Badge variant="warn">{gazelleMeta.notifications.messages} Unread</Badge>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:shrink-0">
          <Button variant="secondary" size="sm" onClick={onPollNow} disabled={polling}>
            {polling ? "Polling..." : "Poll Now"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenSettings} aria-label="Tracker settings">
            <GearIcon width="16" height="16" />
          </Button>
        </div>
      </div>

      {registryEntry?.trackerHubSlug && (
        <div className="my-4">
          <TrackerHubStatus
            trackerHubSlug={registryEntry.trackerHubSlug}
            statusPageUrl={registryEntry.statusPageUrl}
          />
        </div>
      )}

      {stats && <UserProfileCard tracker={tracker} stats={stats} registryEntry={registryEntry} accentColor={tc} />}
    </div>
  )
}
