// src/components/tracker-detail/TrackerDetailHeader.tsx
//
// Functions: TrackerDetailHeader

import Image from "next/image"
import { TrackerHubStatus } from "@/components/TrackerHubStatus"
import { SlotRenderer } from "@/components/tracker-detail/SlotRenderer"
import { UserProfileCard } from "@/components/tracker-detail/UserProfileCard"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { BugIcon, ExternalLinkSmallIcon, GearIcon } from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import { Tooltip } from "@/components/ui/Tooltip"
import { H1 } from "@/components/ui/Typography"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { ResolvedSlot } from "@/lib/slot-types"
import { getHealthBadgeVariant, getHealthDescription, getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

interface TrackerDetailHeaderProps {
  tracker: TrackerSummary
  stats: TrackerLatestStats | null
  registryEntry: TrackerRegistryEntry | undefined
  accentColor: string
  polling: boolean
  onPollNow: () => void
  onOpenSettings: () => void
  onDebugPoll: () => void
  debugLoading: boolean
  badgeSlots: ResolvedSlot[]
}

export function TrackerDetailHeader({
  tracker,
  stats,
  registryEntry,
  accentColor: tc,
  polling,
  onPollNow,
  onOpenSettings,
  onDebugPoll,
  debugLoading,
  badgeSlots,
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
            <Tooltip content={`Open ${tracker.name}`}>
              <a
                href={tracker.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-accent transition-colors duration-150 shrink-0"
              >
                <ExternalLinkSmallIcon width="16" height="16" />
              </a>
            </Tooltip>
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
            <SlotRenderer slots={badgeSlots} bare />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:shrink-0">
          <Tooltip content="Fetch raw API response">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDebugPoll}
              disabled={debugLoading || polling}
              aria-label="Debug: fetch raw API response"
              className="px-2"
            >
              <BugIcon width="16" height="16" />
            </Button>
          </Tooltip>
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
