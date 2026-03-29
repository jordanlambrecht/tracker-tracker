// src/app/(auth)/page.tsx

import { getTrackerListForDashboard } from "@/lib/server-data"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const trackers = await getTrackerListForDashboard()
  return <DashboardClient initialTrackers={trackers} />
}
