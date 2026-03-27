// src/app/(auth)/settings/page.tsx
//
// Functions: SettingsPage

import { getDatabaseSize, getProxyTrackers, getSettingsForClient } from "@/lib/server-data"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsPage() {
  const [settings, proxyTrackers, databaseSize] = await Promise.all([
    getSettingsForClient(),
    getProxyTrackers(),
    getDatabaseSize(),
  ])

  // If settings don't exist, this page shouldn't be reachable
  // (the (auth) layout redirects to /setup)
  if (!settings) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm font-mono text-danger">Settings not configured</p>
      </div>
    )
  }

  return (
    <SettingsClient
      initialSettings={settings}
      initialProxyTrackers={proxyTrackers}
      databaseSize={databaseSize}
    />
  )
}
