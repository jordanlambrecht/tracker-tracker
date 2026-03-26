// src/app/(auth)/settings/SettingsClient.tsx
//
// Functions: SettingsClient

"use client"

import { H1 } from "@typography"
import { useState } from "react"
import { DownloadClients } from "@/components/DownloadClients"
import { NotificationTargets } from "@/components/NotificationTargets"
import { QbitmanageSettings } from "@/components/QbitmanageSettings"
import { AccountSection } from "@/components/settings/AccountSection"
import { BackupsSection } from "@/components/settings/BackupsSection"
import { DangerZoneSection } from "@/components/settings/DangerZoneSection"
import { DataSection } from "@/components/settings/DataSection"
import { EventsSection } from "@/components/settings/EventsSection"
import { ImageHostingSection } from "@/components/settings/ImageHostingSection"
import { PrivacySection } from "@/components/settings/PrivacySection"
import { ProxySection } from "@/components/settings/ProxySection"
import { SecurityPoliciesSection } from "@/components/settings/SecurityPoliciesSection"
import { TwoFactorSection } from "@/components/settings/TwoFactorSection"
import { TagGroups } from "@/components/TagGroups"
import { TabBar } from "@/components/ui/TabBar"
import type { QbitmanageTagConfig } from "@/types/api"

type SettingsTab = "general" | "clients" | "notifications" | "backups" | "events"

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "clients", label: "Download Clients" },
  { key: "notifications", label: "Notifications" },
  { key: "backups", label: "Backups" },
  { key: "events", label: "Events" },
]

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
  hasPtpimgKey: boolean
  hasOeimgKey: boolean
  hasImgbbKey: boolean
}

export interface SettingsClientProps {
  initialSettings: SettingsData
  initialProxyTrackers: { id: number; name: string; color: string }[]
  databaseSize?: string
}

export function SettingsClient({
  initialSettings,
  initialProxyTrackers,
  databaseSize,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10 pb-16">
      <div className="flex flex-col gap-6">
        <H1>Settings</H1>
        <TabBar tabs={SETTINGS_TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "general" && (
        <>
          <AccountSection initialUsername={initialSettings.username ?? ""} />

          <TwoFactorSection />

          <PrivacySection initialStoreUsernames={initialSettings.storeUsernames} />

          <DataSection initialPollInterval={initialSettings.trackerPollIntervalMinutes ?? 60} />

          <ImageHostingSection
            initialHasKeys={{
              ptpimg: initialSettings.hasPtpimgKey,
              oeimg: initialSettings.hasOeimgKey,
              imgbb: initialSettings.hasImgbbKey,
            }}
          />

          <SecurityPoliciesSection
            initialLockout={{
              enabled: initialSettings.lockoutEnabled,
              threshold: initialSettings.lockoutThreshold,
              durationMinutes: initialSettings.lockoutDurationMinutes,
            }}
            initialSnapshotRetentionDays={initialSettings.snapshotRetentionDays}
            initialSessionTimeoutMinutes={initialSettings.sessionTimeoutMinutes}
            databaseSize={databaseSize}
          />

          <ProxySection
            initialProxy={{
              enabled: initialSettings.proxyEnabled,
              type: initialSettings.proxyType || "socks5",
              host: initialSettings.proxyHost ?? "",
              port: initialSettings.proxyPort ?? 1080,
              username: initialSettings.proxyUsername ?? "",
              hasPassword: initialSettings.hasProxyPassword,
            }}
            trackers={initialProxyTrackers}
          />

          <DangerZoneSection />
        </>
      )}

      {activeTab === "clients" && (
        <>
          <DownloadClients />
          <QbitmanageSettings
            initialEnabled={initialSettings.qbitmanageEnabled}
            initialTags={initialSettings.qbitmanageTags}
          />
          <TagGroups />
        </>
      )}

      {activeTab === "notifications" && <NotificationTargets />}

      {activeTab === "backups" && (
        <BackupsSection
          initialConfig={{
            encryptBackups: initialSettings.backupEncryptionEnabled,
            hasBackupPassword: initialSettings.hasBackupPassword,
            scheduleEnabled: initialSettings.backupScheduleEnabled,
            scheduleFrequency: initialSettings.backupScheduleFrequency,
            backupRetentionCount: initialSettings.backupRetentionCount,
            backupStoragePath: initialSettings.backupStoragePath ?? "/data/backups",
          }}
        />
      )}

      {activeTab === "events" && <EventsSection />}
    </div>
  )
}
