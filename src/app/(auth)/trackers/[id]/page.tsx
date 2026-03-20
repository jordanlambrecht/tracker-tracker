// src/app/(auth)/trackers/[id]/page.tsx

import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { parseQbitmanageTags } from "@/lib/qbitmanage-defaults"
import {
  getSnapshotsForTracker,
  getTagGroupsWithMembers,
  getTrackerForClient,
} from "@/lib/server-data"
import type { QbitmanageTagConfig, TrackerSummary } from "@/types/api"
import { TrackerDetailClient } from "./TrackerDetailClient"

export default async function TrackerDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId) || trackerId < 1) notFound()

  const [tracker, snapshots, allTimeSnapshots, tagGroupsData, settingsRow] = await Promise.all([
    getTrackerForClient(trackerId),
    getSnapshotsForTracker(trackerId, 30),
    getSnapshotsForTracker(trackerId, 0),
    getTagGroupsWithMembers(),
    db
      .select({
        qbitmanageEnabled: appSettings.qbitmanageEnabled,
        qbitmanageTags: appSettings.qbitmanageTags,
      })
      .from(appSettings)
      .limit(1),
  ])

  if (!tracker) notFound()

  const settings = settingsRow[0]
  const qbitmanageConfig =
    settings?.qbitmanageEnabled !== undefined
      ? {
          enabled: settings.qbitmanageEnabled,
          tags: parseQbitmanageTags(settings.qbitmanageTags) as QbitmanageTagConfig,
        }
      : null

  return (
    <TrackerDetailClient
      trackerId={trackerId}
      initialTracker={tracker as TrackerSummary}
      initialSnapshots={snapshots}
      initialAllTimeSnapshots={allTimeSnapshots}
      initialTagGroups={tagGroupsData}
      initialQbitmanageConfig={qbitmanageConfig}
    />
  )
}
