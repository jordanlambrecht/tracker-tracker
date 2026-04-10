// src/app/(auth)/page.tsx

import { fetchSettings, getTrackerListForDashboard } from "@/lib/server-data"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const [trackers, settingsResult] = await Promise.all([
    getTrackerListForDashboard(),
    fetchSettings().catch(() => []),
  ])
  const [settings] = settingsResult
  return (
    <DashboardClient
      initialTrackers={trackers}
      snapshotRetentionDays={settings?.snapshotRetentionDays ?? null}
    />
  )
}
