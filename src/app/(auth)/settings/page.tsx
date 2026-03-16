// src/app/(auth)/settings/page.tsx
//
// Functions: SettingsPage

"use client"

import { H1, H2, Paragraph } from "@typography"
import { useEffect, useState } from "react"
import { DownloadClients } from "@/components/DownloadClients"
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
import type { TrackerSummary } from "@/types/api"

type SettingsTab = "general" | "clients" | "tag-groups" | "backups"

interface SettingsData {
  storeUsernames: boolean
  username: string | null
  sessionTimeoutMinutes: number | null
  lockoutEnabled: boolean
  lockoutThreshold: number
  lockoutDurationMinutes: number
  snapshotRetentionDays: number | null
  proxyEnabled: boolean
  proxyType: string
  proxyHost: string | null
  proxyPort: number | null
  proxyUsername: string | null
  hasProxyPassword: boolean
  backupScheduleEnabled: boolean
  backupScheduleFrequency: string
  backupRetentionCount: number
  backupEncryptionEnabled: boolean
  hasBackupPassword: boolean
  backupStoragePath: string | null
  trackerPollIntervalMinutes: number | null
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetched data — null until loaded
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [proxyTrackers, setProxyTrackers] = useState<{ id: number; name: string; color: string }[]>(
    []
  )
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([])

  // Error log (small enough to keep inline)
  const [logLoading, setLogLoading] = useState(false)
  const [logCopied, setLogCopied] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings")
        if (!res.ok) throw new Error("Failed to load settings")
        const data: SettingsData = await res.json()
        if (!cancelled) setSettings(data)
      } catch {
        if (!cancelled) setError("Could not load settings")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function fetchTrackers() {
      try {
        const res = await fetch("/api/trackers")
        if (!res.ok) return
        const data: TrackerSummary[] = await res.json()
        if (!cancelled)
          setProxyTrackers(
            data.filter((t) => t.useProxy).map((t) => ({ id: t.id, name: t.name, color: t.color }))
          )
      } catch {
        // Non-critical — proxy list just won't populate
      }
    }

    async function fetchBackupHistory() {
      try {
        const res = await fetch("/api/settings/backup/history")
        if (!res.ok) return
        const data: BackupRecord[] = await res.json()
        if (!cancelled) setBackupHistory(data)
      } catch {
        // Non-critical
      }
    }

    fetchSettings()
    fetchTrackers()
    fetchBackupHistory()
    return () => {
      cancelled = true
    }
  }, [])

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "clients", label: "Download Clients" },
    { key: "tag-groups", label: "Tag Groups" },
    { key: "backups", label: "Backups" },
  ]

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <H1 className="mb-6">Settings</H1>
        <p className="text-sm font-mono text-tertiary">Loading...</p>
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="max-w-2xl mx-auto">
        <H1 className="mb-6">Settings</H1>
        <p className="text-sm font-mono text-danger">{error ?? "Failed to load settings"}</p>
      </div>
    )
  }

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
        </>
      )}

      {activeTab === "tag-groups" && <TagGroups />}

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
