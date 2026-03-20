// src/app/(auth)/page.tsx

import { getTrackerListForDashboard } from "@/lib/server-data"
import type { TrackerSummary } from "@/types/api"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const trackers = (await getTrackerListForDashboard()) as TrackerSummary[]
  return <DashboardClient initialTrackers={trackers} />
}
