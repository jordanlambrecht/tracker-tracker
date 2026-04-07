// src/app/(auth)/settings/page.tsx

import { Notice } from "@/components/ui/Notice"
import { getDatabaseSize, getProxyTrackers, getSettingsForClient } from "@/lib/server-data"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsPage() {
  const [settings, proxyTrackers, databaseSize] = await Promise.all([
    getSettingsForClient(),
    getProxyTrackers().catch(() => []),
    getDatabaseSize().catch(() => "Unknown"),
  ])

  // If settings don't exist, this page shouldn't be reachable
  // (the (auth) layout redirects to /setup)
  if (!settings) {
    return (
      <div className="max-w-2xl mx-auto">
        <Notice message="Settings not configured" />
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
