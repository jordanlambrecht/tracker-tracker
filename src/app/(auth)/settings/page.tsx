// src/app/(auth)/settings/page.tsx
//
// Functions: SettingsPage

import { desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { backupHistory } from "@/lib/db/schema"
import { getSettingsForClient, getTrackerListForDashboard } from "@/lib/server-data"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsPage() {
  const [settings, trackers, history] = await Promise.all([
    getSettingsForClient(),
    getTrackerListForDashboard(),
    db.select().from(backupHistory).orderBy(desc(backupHistory.createdAt)).limit(50),
  ])

  // If settings don't exist, this page shouldn't be reachable
  // (the (auth) layout redirects to /setup). Defensive guard only.
  if (!settings) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm font-mono text-danger">Settings not configured</p>
      </div>
    )
  }

  const proxyTrackers = trackers
    .filter((t) => t.useProxy)
    .map((t) => ({ id: t.id, name: t.name, color: t.color }))

  // Serialize Dates for client transport — BackupRecord.createdAt is a string
  const serializedHistory = history.map((h) => ({
    ...h,
    createdAt: h.createdAt.toISOString(),
  }))

  return (
    <SettingsClient
      initialSettings={settings}
      initialProxyTrackers={proxyTrackers}
      initialBackupHistory={serializedHistory}
    />
  )
}
