// src/app/(auth)/settings/SettingsClient.tsx
//
// Functions: SettingsClient

"use client"

import { H1, H2, Paragraph } from "@typography"
import { useState } from "react"
import { DownloadClients } from "@/components/DownloadClients"
import { NotificationTargets } from "@/components/NotificationTargets"
import { QbitmanageSettings } from "@/components/QbitmanageSettings"
import { AccountSection } from "@/components/settings/AccountSection"
import { type BackupRecord, BackupsSection } from "@/components/settings/BackupsSection"
import { DangerZoneSection } from "@/components/settings/DangerZoneSection"
import { DataSection } from "@/components/settings/DataSection"
import { ProxySection } from "@/components/settings/ProxySection"
import { SecuritySection } from "@/components/settings/SecuritySection"
import { TagGroups } from "@/components/TagGroups"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { TabBar } from "@/components/ui/TabBar"
import { extractApiError } from "@/lib/client-helpers"
import type { QbitmanageTagConfig } from "@/types/api"

type SettingsTab = "general" | "clients" | "notifications" | "backups"

export interface SettingsData {
  storeUsernames: boolean
  username: string | null
  sessionTimeoutMinutes: number | null
  lockoutEnabled: boolean
  lockoutThreshold: number
  lockoutDurationMinutes: number
  snapshotRetentionDays: number | null
  trackerPollIntervalMinutes: number | null
  proxyEnabled: boolean
  proxyType: string
  proxyHost: string | null
  proxyPort: number | null
  proxyUsername: string | null
  hasProxyPassword: boolean
  qbitmanageEnabled: boolean
  qbitmanageTags: QbitmanageTagConfig
  backupScheduleEnabled: boolean
  backupScheduleFrequency: string
  backupRetentionCount: number
  backupEncryptionEnabled: boolean
  hasBackupPassword: boolean
  backupStoragePath: string | null
}

export interface SettingsClientProps {
  initialSettings: SettingsData
  initialProxyTrackers: { id: number; name: string; color: string }[]
  initialBackupHistory: BackupRecord[]
}

export function SettingsClient({
  initialSettings,
  initialProxyTrackers,
  initialBackupHistory,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")

  const settings = initialSettings
  const proxyTrackers = initialProxyTrackers
  const backupHistory = initialBackupHistory

  // Error log (small enough to keep inline)
  const [logLoading, setLogLoading] = useState(false)
  const [logCopied, setLogCopied] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "clients", label: "Download Clients" },
    { key: "notifications", label: "Notifications" },
    { key: "backups", label: "Backups" },
  ]

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10 pb-16">
      <div className="flex flex-col gap-6">
        <H1>Settings</H1>
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "general" && (
        <>
          <AccountSection
            initialStoreUsernames={settings.storeUsernames}
            initialUsername={settings.username ?? ""}
          />

          <DataSection initialPollInterval={settings.trackerPollIntervalMinutes ?? 60} />

          <SecuritySection
            initialLockout={{
              enabled: settings.lockoutEnabled,
              threshold: settings.lockoutThreshold,
              durationMinutes: settings.lockoutDurationMinutes,
            }}
            initialSnapshotRetentionDays={settings.snapshotRetentionDays}
            initialSessionTimeoutMinutes={settings.sessionTimeoutMinutes}
          />

          <ProxySection
            initialProxy={{
              enabled: settings.proxyEnabled,
              type: settings.proxyType || "socks5",
              host: settings.proxyHost ?? "",
              port: settings.proxyPort ?? 1080,
              username: settings.proxyUsername ?? "",
              hasPassword: settings.hasProxyPassword,
            }}
            trackers={proxyTrackers}
          />

          {/* ── Error Log ──────────────────────────────────────────── */}
          <section aria-labelledby="error-log-heading">
            <H2 id="error-log-heading" className="mb-4">
              Error Log
            </H2>
            <Card elevation="raised" className="flex flex-col gap-4">
              <Paragraph>
                Copy recent log output to share when reporting issues. Logs stay on your machine —
                nothing is sent externally.
              </Paragraph>
              <div className="flex gap-3 items-center">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    setLogLoading(true)
                    setLogError(null)
                    try {
                      const res = await fetch("/api/settings/logs")
                      if (!res.ok)
                        throw new Error(await extractApiError(res, "Failed to load logs"))
                      const data = await res.json()
                      const content = (data as { content: string }).content
                      if (!content) {
                        setLogError("Log file is empty")
                        return
                      }
                      await navigator.clipboard.writeText(content)
                      setLogCopied(true)
                      setTimeout(() => setLogCopied(false), 2000)
                    } catch (err) {
                      setLogError(err instanceof Error ? err.message : "Failed to load logs")
                    } finally {
                      setLogLoading(false)
                    }
                  }}
                  disabled={logLoading}
                >
                  {logLoading ? "Loading…" : logCopied ? "Copied!" : "Copy Log to Clipboard"}
                </Button>
                {logError && <span className="text-sm text-danger font-mono">{logError}</span>}
              </div>
            </Card>
          </section>

          <DangerZoneSection />
        </>
      )}

      {activeTab === "clients" && (
        <>
          <DownloadClients />
          <QbitmanageSettings />
          <TagGroups />
        </>
      )}

      {activeTab === "notifications" && <NotificationTargets />}

      {activeTab === "backups" && (
        <BackupsSection
          initialConfig={{
            encryptBackups: settings.backupEncryptionEnabled,
            hasBackupPassword: settings.hasBackupPassword,
            scheduleEnabled: settings.backupScheduleEnabled,
            scheduleFrequency: settings.backupScheduleFrequency,
            backupRetentionCount: settings.backupRetentionCount,
            backupStoragePath: settings.backupStoragePath ?? "/data/backups",
          }}
          initialHistory={backupHistory}
        />
      )}
    </div>
  )
}
