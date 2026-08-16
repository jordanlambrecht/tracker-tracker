// src/app/(auth)/page.tsx

import {
  fetchSettings,
  getTagGroupsWithMembers,
  getTrackerListForDashboard,
} from "@/lib/server-data"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  // Tag groups are opt-in via Settings and reading them is two small queries, so the server
  // can cheaply tell the client whether the Tag Groups section applies at all. The counts
  // themselves come from the cached fleet aggregation, fetched on the client — computing
  // them here would put the whole fleet pass in front of this page's TTFB, and would freeze
  // the counts until a full reload.
  const [trackers, settingsResult, tagGroups] = await Promise.all([
    getTrackerListForDashboard(),
    fetchSettings().catch(() => []),
    getTagGroupsWithMembers().catch(() => []),
  ])
  const [settings] = settingsResult

  return (
    <DashboardClient
      initialTrackers={trackers}
      snapshotRetentionDays={settings?.snapshotRetentionDays ?? null}
      hasTagGroups={tagGroups.length > 0}
    />
  )
}
