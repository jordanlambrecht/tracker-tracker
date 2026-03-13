// src/app/(auth)/settings/page.tsx
//
// Functions: SettingsPage

"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import { DownloadClients } from "@/components/DownloadClients"
import { QbitmanageSettings } from "@/components/QbitmanageSettings"
import { TagGroups } from "@/components/TagGroups"
import { TwoFactorSetup } from "@/components/TwoFactorSetup"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Checkbox } from "@/components/ui/Checkbox"
import { Input } from "@/components/ui/Input"
import { NumberInput } from "@/components/ui/NumberInput"
import { RedactedText } from "@/components/ui/RedactedText"
import { Select } from "@/components/ui/Select"
import { TabBar } from "@/components/ui/TabBar"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { Toggle } from "@/components/ui/Toggle"
import { H1, H2, H3, Paragraph, Subtext } from "@/components/ui/Typography"
import { formatBytesFromNumber } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

type SettingsTab = "general" | "clients" | "tag-groups" | "backups"
type ScrubState = "idle" | "confirming" | "scrubbing"

interface BackupRecord {
  id: number
  createdAt: string
  sizeBytes: number
  encrypted: boolean
  frequency: string | null
  status: string
  storagePath: string | null
  notes: string | null
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")

  // --- Privacy (wired) ---
  const [storeUsernames, setStoreUsernames] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scrubState, setScrubState] = useState<ScrubState>("idle")
  const [error, setError] = useState<string | null>(null)

  // --- Account ---
  const [username, setUsername] = useState("")
  const [savedUsername, setSavedUsername] = useState("")
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // --- Security ---
  const [autoWipeEnabled, setAutoWipeEnabled] = useState(false)
  const [autoWipeThreshold, setAutoWipeThreshold] = useState(5)
  const [savedAutoWipe, setSavedAutoWipe] = useState<{ enabled: boolean; threshold: number }>({ enabled: false, threshold: 5 })
  const [savingAutoWipe, setSavingAutoWipe] = useState(false)
  const [autoWipeError, setAutoWipeError] = useState<string | null>(null)
  const [autoWipeSuccess, setAutoWipeSuccess] = useState(false)
  const [retentionEnabled, setRetentionEnabled] = useState(false)
  const [retentionDays, setRetentionDays] = useState(90)
  const [savedRetention, setSavedRetention] = useState<{ enabled: boolean; days: number }>({ enabled: false, days: 90 })
  const [savingRetention, setSavingRetention] = useState(false)
  const [retentionError, setRetentionError] = useState<string | null>(null)
  const [retentionSuccess, setRetentionSuccess] = useState(false)

  // --- Poll interval ---
  const [pollInterval, setPollInterval] = useState(60)
  const [savedPollInterval, setSavedPollInterval] = useState(60)
  const [savingPollInterval, setSavingPollInterval] = useState(false)
  const [pollIntervalError, setPollIntervalError] = useState<string | null>(null)
  const [pollIntervalSuccess, setPollIntervalSuccess] = useState(false)

  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false)
  const [autoLogoutDays, setAutoLogoutDays] = useState(0)
  const [autoLogoutHours, setAutoLogoutHours] = useState(1)
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(0)
  const [savedTimeoutMinutes, setSavedTimeoutMinutes] = useState<number | null>(null)
  const [savingTimeout, setSavingTimeout] = useState(false)
  const [timeoutError, setTimeoutError] = useState<string | null>(null)
  const [timeoutSuccess, setTimeoutSuccess] = useState(false)

  // --- Proxy ---
  const [proxyTrackers, setProxyTrackers] = useState<{ id: number; name: string; color: string }[]>([])
  const [proxyEnabled, setProxyEnabled] = useState(false)
  const [proxyType, setProxyType] = useState("socks5")
  const [proxyHost, setProxyHost] = useState("")
  const [proxyPort, setProxyPort] = useState(1080)
  const [proxyUsername, setProxyUsername] = useState("")
  const [proxyPassword, setProxyPassword] = useState("")
  const [proxyPasswordPlaceholder, setProxyPasswordPlaceholder] = useState(false)
  const [proxyTestStatus, setProxyTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle")
  const [proxyTestIp, setProxyTestIp] = useState<string | null>(null)
  const [proxyTestError, setProxyTestError] = useState<string | null>(null)
  const [savingProxy, setSavingProxy] = useState(false)
  const [proxyError, setProxyError] = useState<string | null>(null)
  const [proxySuccess, setProxySuccess] = useState(false)
  const [savedProxy, setSavedProxy] = useState({ enabled: false, type: "socks5", host: "", port: 1080, username: "", hasPassword: false })

  // --- Danger zone ---
  const [confirmResetStats, setConfirmResetStats] = useState(false)
  const [resetStatsSubmitting, setResetStatsSubmitting] = useState(false)
  const [resetStatsError, setResetStatsError] = useState<string | null>(null)
  const [resetStatsSuccess, setResetStatsSuccess] = useState(false)
  const [confirmLockdown, setConfirmLockdown] = useState(false)
  const [lockdownChecks, setLockdownChecks] = useState({ sessions: false, tokens: false, totp: false })
  const [lockdownSubmitting, setLockdownSubmitting] = useState(false)
  const [lockdownError, setLockdownError] = useState<string | null>(null)
  const [confirmNuke, setConfirmNuke] = useState(false)
  const [nukePassword, setNukePassword] = useState("")
  const [nukeSubmitting, setNukeSubmitting] = useState(false)
  const [nukeError, setNukeError] = useState<string | null>(null)

  // --- Backups ---
  const [encryptBackups, setEncryptBackups] = useState(false)
  const [exportPassword, setExportPassword] = useState("") // Password for encrypting backups
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleFrequency, setScheduleFrequency] = useState("daily")
  const [backupRetentionCount, setBackupRetentionCount] = useState(14)
  const [backupStoragePath, setBackupStoragePath] = useState("")
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([])
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [savingBackupConfig, setSavingBackupConfig] = useState(false)
  const [savedBackupConfig, setSavedBackupConfig] = useState({
    encryptBackups: false,
    scheduleEnabled: false,
    scheduleFrequency: "daily",
    backupRetentionCount: 14,
    backupStoragePath: "",
  })
  const [restorePassword, setRestorePassword] = useState("")
  const [backupPassword, setBackupPassword] = useState("") // Password for restoring encrypted backups
  const [restoreConfirmPhrase, setRestoreConfirmPhrase] = useState("") // Typed confirmation
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [isEncryptedBackup, setIsEncryptedBackup] = useState(false) // Track if restore file is encrypted
  const [deletingBackupId, setDeletingBackupId] = useState<number | null>(null)
  const [isDraggingRestore, setIsDraggingRestore] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  // --- Error log ---
  const [logLoading, setLogLoading] = useState(false)
  const [logCopied, setLogCopied] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings")
        if (!res.ok) throw new Error("Failed to load settings")
        const data: {
          storeUsernames: boolean
          username: string | null
          sessionTimeoutMinutes: number | null
          autoWipeThreshold: number | null
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
          backupStoragePath: string | null
          trackerPollIntervalMinutes: number | null
        } = await res.json()
        if (cancelled) return
        setStoreUsernames(data.storeUsernames)
        setUsername(data.username ?? "")
        setSavedUsername(data.username ?? "")
        setSavedTimeoutMinutes(data.sessionTimeoutMinutes)
        // Auto-wipe
        if (data.autoWipeThreshold && data.autoWipeThreshold > 0) {
          setAutoWipeEnabled(true)
          setAutoWipeThreshold(data.autoWipeThreshold)
          setSavedAutoWipe({ enabled: true, threshold: data.autoWipeThreshold })
        }
        // Snapshot retention
        if (data.snapshotRetentionDays && data.snapshotRetentionDays > 0) {
          setRetentionEnabled(true)
          setRetentionDays(data.snapshotRetentionDays)
          setSavedRetention({ enabled: true, days: data.snapshotRetentionDays })
        }
        if (data.sessionTimeoutMinutes && data.sessionTimeoutMinutes > 0) {
          setAutoLogoutEnabled(true)
          const total = data.sessionTimeoutMinutes
          setAutoLogoutDays(Math.floor(total / 1440))
          setAutoLogoutHours(Math.floor((total % 1440) / 60))
          setAutoLogoutMinutes(total % 60)
        }
        // Proxy
        setProxyEnabled(data.proxyEnabled)
        setProxyType(data.proxyType || "socks5")
        setProxyHost(data.proxyHost ?? "")
        setProxyPort(data.proxyPort ?? 1080)
        setProxyUsername(data.proxyUsername ?? "")
        setProxyPasswordPlaceholder(data.hasProxyPassword)
        setSavedProxy({
          enabled: data.proxyEnabled,
          type: data.proxyType || "socks5",
          host: data.proxyHost ?? "",
          port: data.proxyPort ?? 1080,
          username: data.proxyUsername ?? "",
          hasPassword: data.hasProxyPassword,
        })
        // Backup config
        setEncryptBackups(data.backupEncryptionEnabled)
        setScheduleEnabled(data.backupScheduleEnabled)
        setScheduleFrequency(data.backupScheduleFrequency)
        setBackupRetentionCount(data.backupRetentionCount)
        setBackupStoragePath(data.backupStoragePath ?? "")
        setSavedBackupConfig({
          encryptBackups: data.backupEncryptionEnabled,
          scheduleEnabled: data.backupScheduleEnabled,
          scheduleFrequency: data.backupScheduleFrequency,
          backupRetentionCount: data.backupRetentionCount,
          backupStoragePath: data.backupStoragePath ?? "",
        })
        // Poll interval
        if (data.trackerPollIntervalMinutes) {
          setPollInterval(data.trackerPollIntervalMinutes)
          setSavedPollInterval(data.trackerPollIntervalMinutes)
        }
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
        if (!cancelled) setProxyTrackers(
          data
            .filter((t) => t.useProxy)
            .map((t) => ({ id: t.id, name: t.name, color: t.color }))
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
    return () => { cancelled = true }
  }, [])

  const patchSettings = useCallback(async (payload: { storeUsernames: boolean; scrubExisting?: boolean }) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        throw new Error((data as { error?: string }).error ?? "Save failed")
      }
      const result: { storeUsernames: boolean } = await res.json()
      setStoreUsernames(result.storeUsernames)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSaving(false)
      setScrubState("idle")
    }
  }, [])

  function handleToggle(checked: boolean) {
    if (checked) {
      patchSettings({ storeUsernames: true })
    } else {
      setScrubState("confirming")
    }
  }

  function handleScrubYes() {
    setScrubState("scrubbing")
    patchSettings({ storeUsernames: false, scrubExisting: true })
  }

  function handleScrubNo() {
    setScrubState("idle")
    patchSettings({ storeUsernames: false })
  }

  function handleScrubCancel() {
    setScrubState("idle")
  }

  const router = useRouter()

  async function handleSaveUsername() {
    setUsernameError(null)
    const trimmed = username.trim()
    if (trimmed && trimmed.length < 3) {
      setUsernameError("Username must be at least 3 characters")
      return
    }
    setSavingUsername(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        throw new Error((data as { error?: string }).error ?? "Save failed")
      }
      const result: { username: string | null } = await res.json()
      setUsername(result.username ?? "")
      setSavedUsername(result.username ?? "")
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSavingUsername(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError(null)
    if (!currentPassword) {
      setPasswordError("Current password is required")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed" }))
        throw new Error((data as { error?: string }).error ?? "Failed")
      }
      router.push("/login")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleSaveProxy() {
    setSavingProxy(true)
    setProxyError(null)
    setProxySuccess(false)
    try {
      const payload: Record<string, unknown> = {
        proxyEnabled,
        proxyType,
        proxyHost: proxyHost.trim() || null,
        proxyPort,
        proxyUsername: proxyUsername.trim() || null,
      }
      // Only send password if user typed a new one
      if (proxyPassword) {
        payload.proxyPassword = proxyPassword
      } else if (!proxyPasswordPlaceholder) {
        // User cleared the password
        payload.proxyPassword = null
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        throw new Error((data as { error?: string }).error ?? "Save failed")
      }
      const result: {
        proxyEnabled: boolean
        proxyType: string
        proxyHost: string | null
        proxyPort: number | null
        proxyUsername: string | null
        hasProxyPassword: boolean
      } = await res.json()
      setSavedProxy({
        enabled: result.proxyEnabled,
        type: result.proxyType,
        host: result.proxyHost ?? "",
        port: result.proxyPort ?? 1080,
        username: result.proxyUsername ?? "",
        hasPassword: result.hasProxyPassword,
      })
      setProxyPasswordPlaceholder(result.hasProxyPassword)
      setProxyPassword("")
      setProxySuccess(true)
    } catch (err) {
      setProxyError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSavingProxy(false)
    }
  }

  async function handleTestProxy() {
    setProxyTestStatus("testing")
    setProxyTestIp(null)
    setProxyTestError(null)
    try {
      const res = await fetch("/api/settings/proxy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyType,
          proxyHost: proxyHost.trim(),
          proxyPort,
          proxyUsername: proxyUsername.trim() || undefined,
          proxyPassword: proxyPassword || undefined,
          useStoredPassword: proxyPasswordPlaceholder && !proxyPassword,
        }),
      })
      const data: { success: boolean; proxyIp?: string; error?: string } = await res.json()
      if (data.success) {
        setProxyTestStatus("success")
        setProxyTestIp(data.proxyIp ?? null)
      } else {
        setProxyTestStatus("failed")
        setProxyTestError(data.error ?? "Connection failed")
      }
    } catch {
      setProxyTestStatus("failed")
      setProxyTestError("Network error")
    }
  }

  const proxyHasChanges =
    proxyEnabled !== savedProxy.enabled ||
    proxyType !== savedProxy.type ||
    proxyHost !== savedProxy.host ||
    proxyPort !== savedProxy.port ||
    proxyUsername !== savedProxy.username ||
    (proxyPassword !== "" && proxyPassword !== undefined)

  async function handleBackupNow() {
    if (encryptBackups && !exportPassword) {
      setBackupError("Backup password is required when encryption is enabled")
      return
    }
    setBackingUp(true)
    setBackupError(null)
    try {
      const formData = new FormData()
      if (encryptBackups && exportPassword) {
        formData.append("backupPassword", exportPassword)
      }
      const res = await fetch("/api/settings/backup/export", { 
        method: "POST",
        body: formData
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Export failed" }))
        throw new Error((data as { error?: string }).error ?? "Export failed")
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] ?? `tracker-tracker-backup-${Date.now()}.json`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const histRes = await fetch("/api/settings/backup/history")
      if (histRes.ok) setBackupHistory(await histRes.json())
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestoreFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    await prepareRestoreFile(file)
  }

  async function prepareRestoreFile(file: File | null) {
    setRestoreFile(file)
    if (file) {
      // Detect if file is encrypted by checking format field
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const isEncrypted = json.format === "tracker-tracker-encrypted-backup"
        setIsEncryptedBackup(isEncrypted)
      } catch {
        setIsEncryptedBackup(false) // If can't parse, assume not encrypted
      }
      setShowRestoreConfirm(true)
      setRestorePassword("")
      setBackupPassword("")
      setBackupError(null)
    }
  }

  async function handleRestore() {
    if (!restoreFile) return
    if (!restorePassword) return // Master password required for authorization
    if (isEncryptedBackup && !backupPassword) return // Backup password required for decryption
    setRestoring(true)
    setBackupError(null)
    try {
      const formData = new FormData()
      formData.append("file", restoreFile)
      formData.append("masterPassword", restorePassword) // Always required for authorization
      if (isEncryptedBackup && backupPassword) {
        formData.append("backupPassword", backupPassword) // Required for decryption
      }
      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Restore failed")
      }
      // Success — clean up and reload to show restored data
      setShowRestoreConfirm(false)
      setRestoreFile(null)
      setRestorePassword("") // Clear master password
      setBackupPassword("") // Clear backup password
      setRestoreConfirmPhrase("") // Clear confirmation phrase
      // Reload to reflect restored settings
      window.location.reload()
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Restore failed")
      // Keep dialog open on error so user can see the error message
    } finally {
      setRestoring(false)
    }
  }

  async function handleDownloadBackup(id: number) {
    try {
      const res = await fetch(`/api/settings/backup/${id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Download failed" }))
        throw new Error((data as { error?: string }).error ?? "Download failed")
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] ?? `tracker-tracker-backup-${id}.json`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Download failed")
    }
  }

  async function handleDeleteBackup(id: number) {
    setDeletingBackupId(id)
    try {
      const res = await fetch(`/api/settings/backup/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        console.error("Failed to delete backup")
      }
      setBackupHistory((prev) => prev.filter((b) => b.id !== id))
    } catch {
      console.error("Failed to delete backup")
    } finally {
      setDeletingBackupId(null)
    }
  }

  const backupColumns: Column<BackupRecord>[] = [
    {
      key: "date",
      header: "Date",
      render: (b) => (
        <span className="text-sm font-mono text-primary tabular-nums">
          {new Date(b.createdAt).toLocaleString()}
          {b.encrypted && (
            <span className="ml-2 text-xs text-accent" title="Encrypted">🔒</span>
          )}
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (b) => (
        <span className="text-sm font-mono text-tertiary tabular-nums">
          {formatBytesFromNumber(b.sizeBytes)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (b) => (
        <Badge variant={b.status === "completed" ? "success" : "danger"}>
          {b.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (b) => (
        <div className="flex gap-2 justify-end">
          {b.storagePath && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownloadBackup(b.id)}
            >
              Download
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDeleteBackup(b.id)}
            disabled={deletingBackupId === b.id}
          >
            {deletingBackupId === b.id ? "Deleting…" : "Delete"}
          </Button>
        </div>
      ),
    },
  ]

  const backupConfigDirty =
    encryptBackups !== savedBackupConfig.encryptBackups ||
    scheduleEnabled !== savedBackupConfig.scheduleEnabled ||
    scheduleFrequency !== savedBackupConfig.scheduleFrequency ||
    backupRetentionCount !== savedBackupConfig.backupRetentionCount ||
    backupStoragePath !== savedBackupConfig.backupStoragePath

  async function saveBackupConfig() {
    setSavingBackupConfig(true)
    setBackupError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupEncryptionEnabled: encryptBackups,
          backupScheduleEnabled: scheduleEnabled,
          backupScheduleFrequency: scheduleFrequency,
          backupRetentionCount: backupRetentionCount,
          backupStoragePath: backupStoragePath || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        throw new Error((data as { error?: string }).error ?? "Save failed")
      }
      setSavedBackupConfig({
        encryptBackups,
        scheduleEnabled,
        scheduleFrequency,
        backupRetentionCount,
        backupStoragePath,
      })
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingBackupConfig(false)
    }
  }

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

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10 pb-16">
      <div className="flex flex-col gap-6">
        <H1>Settings</H1>

        {/* Tab bar */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "general" && (
        <>
      {/* ── Account ────────────────────────────────────────────── */}
      <section aria-labelledby="account-heading">
        <H2 id="account-heading" className="mb-4">Account</H2>

        <Card elevation="raised" className="flex flex-col gap-6">
          {/* Change Username */}
          <div className="flex flex-col gap-3">
            <H3>Username</H3>
            <Input
              label="Login Username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setUsernameError(null)
              }}
              placeholder="Min. 6 characters (optional)"
              error={usernameError ?? undefined}
              disabled={savingUsername}
            />
            <Paragraph>
              Used to log in alongside your master password. Leave empty to remove.
            </Paragraph>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveUsername}
                disabled={savingUsername || username === savedUsername}
              >
                {savingUsername ? "Saving…" : "Save Username"}
              </Button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Change Password */}
          <div className="flex flex-col gap-3">
            <H3>Change Password</H3>
            <Input
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                setPasswordError(null)
              }}
              placeholder="••••••••"
              disabled={savingPassword}
            />
            <Input
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setPasswordError(null)
              }}
              placeholder="Min. 8 characters"
              disabled={savingPassword}
            />
            <Input
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setPasswordError(null)
              }}
              placeholder="••••••••"
              disabled={savingPassword}
            />
            <Paragraph>
              Re-encrypts all stored API tokens. You will be logged out.
            </Paragraph>
            {passwordError && (
              <p className="text-xs font-sans text-danger" role="alert">{passwordError}</p>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {savingPassword ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Data ────────────────────────────────────────────────── */}
      <section aria-labelledby="data-heading">
        <H2 id="data-heading" className="mb-4">Data</H2>

        <Card elevation="raised" className="overflow-visible">
          {/* Poll interval */}
          <div className="flex flex-col gap-3 ">
            <H3>Tracker Poll Interval</H3>
            <Paragraph>
              How often all trackers are polled for new stats. All trackers
              poll on the same schedule to keep data points aligned.
            </Paragraph>
            <Select
              value={String(pollInterval)}
              onChange={(v) => { setPollInterval(Number(v)); setPollIntervalSuccess(false) }}
              ariaLabel="Poll interval"
              label="Interval"
              size="md"
              className="max-w-48 "
              options={[
                { value: "15", label: "15 min" },
                { value: "30", label: "30 min" },
                { value: "60", label: "1 hour" },
                { value: "180", label: "3 hours" },
                { value: "360", label: "6 hours" },
                { value: "720", label: "12 hours" },
                { value: "1440", label: "24 hours" },
              ]}
            />
            {pollIntervalError && (
              <p className="text-xs font-sans text-danger" role="alert">{pollIntervalError}</p>
            )}
            {pollIntervalSuccess && (
              <p className="text-xs font-sans text-success">Poll interval saved.</p>
            )}
            {pollInterval !== savedPollInterval && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={savingPollInterval}
                  onClick={async () => {
                    setSavingPollInterval(true)
                    setPollIntervalError(null)
                    setPollIntervalSuccess(false)
                    try {
                      const res = await fetch("/api/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ trackerPollIntervalMinutes: pollInterval }),
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({ error: "Save failed" }))
                        throw new Error((data as { error?: string }).error ?? "Save failed")
                      }
                      const result: { trackerPollIntervalMinutes: number } = await res.json()
                      setSavedPollInterval(result.trackerPollIntervalMinutes)
                      setPollIntervalSuccess(true)
                    } catch (err) {
                      setPollIntervalError(err instanceof Error ? err.message : "Network error")
                    } finally {
                      setSavingPollInterval(false)
                    }
                  }}
                >
                  {savingPollInterval ? "Saving…" : "Save Interval"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ── Two-Factor Authentication ─────────────────────────── */}
      <section aria-labelledby="2fa-heading">
        <H2 id="2fa-heading" className="mb-4">Two-Factor Authentication</H2>

        <Card elevation="raised">
          <TwoFactorSetup />
        </Card>
      </section>

      {/* ── Security Policies ─────────────────────────────────── */}
      <section aria-labelledby="security-policies-heading">
        <H2 id="security-policies-heading" className="mb-4">Security Policies</H2>

        <Card elevation="raised" className="flex flex-col gap-5">
          {/* Auto-wipe on failed logins */}
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={autoWipeEnabled}
              onChange={(v) => { setAutoWipeEnabled(v); setAutoWipeSuccess(false); setAutoWipeError(null) }}
            >
              Delete all data after{" "}
              <NumberInput
                value={autoWipeThreshold}
                onChange={(v) => { setAutoWipeThreshold(v); setAutoWipeSuccess(false) }}
                min={1}
                max={99}
                disabled={!autoWipeEnabled}
                className="mx-1 inline-flex align-middle"
              />{" "}
              failed login attempts
            </Checkbox>
            <Paragraph className="ml-8">
              Automatically scrubs and deletes all trackers, snapshots, and settings
              after consecutive failed login attempts. The application resets to
              first-run setup.
            </Paragraph>
            {autoWipeEnabled && (
              <p className="text-xs font-sans leading-relaxed ml-8 text-warn">
                Mistyping your password {autoWipeThreshold} time{autoWipeThreshold === 1 ? "" : "s"} in
                a row will permanently destroy all data.
              </p>
            )}
            {autoWipeError && (
              <p className="text-xs font-sans text-danger ml-8" role="alert">{autoWipeError}</p>
            )}
            {autoWipeSuccess && (
              <p className="text-xs font-sans text-success ml-8">Auto-wipe setting saved.</p>
            )}
            {(autoWipeEnabled !== savedAutoWipe.enabled || (autoWipeEnabled && autoWipeThreshold !== savedAutoWipe.threshold)) && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={savingAutoWipe}
                  onClick={async () => {
                    setSavingAutoWipe(true)
                    setAutoWipeError(null)
                    setAutoWipeSuccess(false)
                    try {
                      const value = autoWipeEnabled ? autoWipeThreshold : null
                      const res = await fetch("/api/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ autoWipeThreshold: value }),
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({ error: "Save failed" }))
                        throw new Error((data as { error?: string }).error ?? "Save failed")
                      }
                      const result: { autoWipeThreshold: number | null } = await res.json()
                      const saved = result.autoWipeThreshold
                      setSavedAutoWipe({
                        enabled: saved !== null && saved > 0,
                        threshold: saved ?? 5,
                      })
                      setAutoWipeSuccess(true)
                    } catch (err) {
                      setAutoWipeError(err instanceof Error ? err.message : "Network error")
                    } finally {
                      setSavingAutoWipe(false)
                    }
                  }}
                >
                  {savingAutoWipe ? "Saving…" : "Save Auto-Wipe"}
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Snapshot data retention */}
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={retentionEnabled}
              onChange={(v) => { setRetentionEnabled(v); setRetentionSuccess(false); setRetentionError(null) }}
            >
              Auto-delete snapshots older than{" "}
              <NumberInput
                value={retentionDays}
                onChange={(v) => { setRetentionDays(v); setRetentionSuccess(false) }}
                min={7}
                max={3650}
                disabled={!retentionEnabled}
                className="mx-1 inline-flex align-middle"
              />{" "}
              days
            </Checkbox>
            <Paragraph className="ml-8">
              Automatically prunes historical snapshot data older than the configured
              period. Reduces what&apos;s stored on disk. Disabled means data is kept
              indefinitely.
            </Paragraph>
            {retentionError && (
              <p className="text-xs font-sans text-danger ml-8" role="alert">{retentionError}</p>
            )}
            {retentionSuccess && (
              <p className="text-xs font-sans text-success ml-8">Retention setting saved.</p>
            )}
            {(retentionEnabled !== savedRetention.enabled || (retentionEnabled && retentionDays !== savedRetention.days)) && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={savingRetention}
                  onClick={async () => {
                    setSavingRetention(true)
                    setRetentionError(null)
                    setRetentionSuccess(false)
                    try {
                      const value = retentionEnabled ? retentionDays : null
                      const res = await fetch("/api/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ snapshotRetentionDays: value }),
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({ error: "Save failed" }))
                        throw new Error((data as { error?: string }).error ?? "Save failed")
                      }
                      const result: { snapshotRetentionDays: number | null } = await res.json()
                      const saved = result.snapshotRetentionDays
                      setSavedRetention({
                        enabled: saved !== null && saved > 0,
                        days: saved ?? 90,
                      })
                      setRetentionSuccess(true)
                    } catch (err) {
                      setRetentionError(err instanceof Error ? err.message : "Network error")
                    } finally {
                      setSavingRetention(false)
                    }
                  }}
                >
                  {savingRetention ? "Saving…" : "Save Retention"}
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Auto-logout after inactivity */}
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={autoLogoutEnabled}
              onChange={(v) => {
                setAutoLogoutEnabled(v)
                setTimeoutError(null)
                setTimeoutSuccess(false)
              }}
            >
              Auto log out after{" "}
              <NumberInput
                value={autoLogoutDays}
                onChange={(v) => { setAutoLogoutDays(v); setTimeoutSuccess(false) }}
                min={0}
                max={365}
                disabled={!autoLogoutEnabled}
                className="mx-1 inline-flex align-middle"
              />{" "}
              days{" "}
              <NumberInput
                value={autoLogoutHours}
                onChange={(v) => { setAutoLogoutHours(v); setTimeoutSuccess(false) }}
                min={0}
                max={23}
                disabled={!autoLogoutEnabled}
                className="mx-1 inline-flex align-middle"
              />{" "}
              hours{" "}
              <NumberInput
                value={autoLogoutMinutes}
                onChange={(v) => { setAutoLogoutMinutes(v); setTimeoutSuccess(false) }}
                min={0}
                max={59}
                disabled={!autoLogoutEnabled}
                className="mx-1 inline-flex align-middle"
              />{" "}
              minutes
            </Checkbox>
            <Paragraph className="ml-8">
              Automatically ends your session after a period of inactivity.
              You will need to log in again with your master password.
            </Paragraph>
            {autoLogoutEnabled && autoLogoutDays === 0 && autoLogoutHours === 0 && autoLogoutMinutes === 0 && (
              <p className="text-xs font-sans leading-relaxed ml-8 text-warn">
                All values are zero — auto-logout is effectively disabled.
              </p>
            )}
            {timeoutError && (
              <p className="text-xs font-sans text-danger ml-8" role="alert">{timeoutError}</p>
            )}
            {timeoutSuccess && (
              <p className="text-xs font-sans text-success ml-8">Session timeout saved. Takes effect on next page load.</p>
            )}
            {(() => {
              const currentTotal = autoLogoutEnabled
                ? autoLogoutDays * 1440 + autoLogoutHours * 60 + autoLogoutMinutes
                : 0
              const currentValue = currentTotal > 0 ? currentTotal : null
              const hasChanged = currentValue !== savedTimeoutMinutes
              if (!hasChanged) return null
              return (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={savingTimeout || (autoLogoutEnabled && currentTotal === 0)}
                    onClick={async () => {
                      setSavingTimeout(true)
                      setTimeoutError(null)
                      setTimeoutSuccess(false)
                      try {
                        const res = await fetch("/api/settings", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ sessionTimeoutMinutes: currentValue }),
                        })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({ error: "Save failed" }))
                          throw new Error((data as { error?: string }).error ?? "Save failed")
                        }
                        const result: { sessionTimeoutMinutes: number | null } = await res.json()
                        setSavedTimeoutMinutes(result.sessionTimeoutMinutes)
                        setTimeoutSuccess(true)
                      } catch (err) {
                        setTimeoutError(err instanceof Error ? err.message : "Network error")
                      } finally {
                        setSavingTimeout(false)
                      }
                    }}
                  >
                    {savingTimeout ? "Saving…" : "Save Timeout"}
                  </Button>
                </div>
              )
            })()}
          </div>
        </Card>
      </section>

      {/* ── Privacy ────────────────────────────────────────────── */}
      <section aria-labelledby="privacy-heading">
        <H2 id="privacy-heading" className="mb-4">Privacy</H2>

        <Card elevation="raised" className="flex flex-col gap-5">
          <Toggle
            label="Store tracker usernames"
            checked={storeUsernames}
            onChange={handleToggle}
            disabled={saving || scrubState === "scrubbing"}
            description="When disabled, tracker usernames and user classes are replaced with redacted markers before being saved to the database."
          />

          {!storeUsernames && (
            <div className="flex items-center gap-3 text-xs font-mono text-tertiary">
              <span>Preview:</span>
              <RedactedText value="▓8" color="var(--color-accent)" />
            </div>
          )}

          {scrubState === "confirming" && (
            <div
              className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-warn-dim"
            >
              <p className="text-sm font-sans text-primary leading-relaxed">
                Also scrub existing usernames from historical data?
              </p>
              <Paragraph>
                This will permanently replace all stored usernames and user classes with
                redacted markers. This cannot be undone.
              </Paragraph>
              <div className="flex gap-3">
                <Button size="sm" variant="danger" onClick={handleScrubYes}>
                  Yes, scrub history
                </Button>
                <Button size="sm" variant="primary" onClick={handleScrubNo}>
                  No, keep history
                </Button>
                <Button size="sm" variant="ghost" onClick={handleScrubCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {scrubState === "scrubbing" && (
            <p className="text-xs font-mono text-warn">Scrubbing historical data...</p>
          )}

          <Subtext>
            This does not provide strong anonymization. Character count and other data
            points may still allow correlation. For full protection, deploy on an
            encrypted filesystem.
          </Subtext>

          {error && (
            <p className="text-xs font-sans text-danger" role="alert">
              {error}
            </p>
          )}
        </Card>
      </section>

      {/* ── Proxy ──────────────────────────────────────────────── */}
      <section aria-labelledby="proxy-heading">
        <H2 id="proxy-heading" className="mb-4">Proxy</H2>

        <div className="flex items-center gap-2 mb-3 px-1 text-warn text-xs font-mono">
          <span aria-hidden="true">⚠</span>
          <span>EXPERIMENTAL — Use at your own risk. May result in IP leaks and/or angry mods.</span>
        </div>

        <Card elevation="raised" className="flex flex-col gap-5">
          <Toggle
            label="Route tracker requests through a proxy"
            checked={proxyEnabled}
            onChange={(v) => { setProxyEnabled(v); setProxySuccess(false) }}
            description="When enabled, all API polling requests to trackers are routed through the configured proxy server instead of your direct IP."
          />

          {proxyEnabled && (
            <>
              <div className="border-t border-border" />

              <div className="flex gap-4 items-end">
                <div className="w-36">
                  <Select
                    label="Type"
                    value={proxyType}
                    onChange={setProxyType}
                    ariaLabel="Proxy type"
                    size="md"
                    options={[
                      { value: "socks5", label: "SOCKS5" },
                      { value: "http", label: "HTTP" },
                      { value: "https", label: "HTTPS" },
                    ]}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="Host"
                    value={proxyHost}
                    onChange={(e) => setProxyHost(e.target.value)}
                    placeholder="127.0.0.1 or proxy.example.com"
                  />
                </div>
                <NumberInput
                  label="Port"
                  value={proxyPort}
                  onChange={setProxyPort}
                  min={1}
                  max={65535}
                />
              </div>

              <div className="border-t border-border" />

              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    label="Username"
                    value={proxyUsername}
                    onChange={(e) => setProxyUsername(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="password"
                    label="Password"
                    value={proxyPassword}
                    onChange={(e) => {
                      setProxyPassword(e.target.value)
                      setProxySuccess(false)
                    }}
                    placeholder={proxyPasswordPlaceholder ? "••••••••" : "Optional"}
                  />
                </div>
              </div>

              <Subtext>
                Credentials are only required if your proxy server uses authentication.
                They are encrypted at rest alongside your API tokens.
              </Subtext>

              <div className="border-t border-border" />

              {/* Save proxy */}
              {proxyError && (
                <p className="text-xs font-sans text-danger" role="alert">{proxyError}</p>
              )}
              {proxySuccess && (
                <p className="text-xs font-sans text-success">Proxy settings saved.</p>
              )}
              {proxyHasChanges && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={savingProxy || !proxyHost.trim()}
                    onClick={handleSaveProxy}
                  >
                    {savingProxy ? "Saving…" : "Save Proxy"}
                  </Button>
                </div>
              )}

              <div className="border-t border-border" />

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!proxyHost.trim() || proxyTestStatus === "testing"}
                  onClick={handleTestProxy}
                >
                  {proxyTestStatus === "testing"
                    ? "Testing..."
                    : proxyTestStatus === "success"
                      ? "Connected"
                      : proxyTestStatus === "failed"
                        ? "Failed — Retry"
                        : "Test Connection"}
                </Button>
                {proxyTestStatus === "success" && (
                  <Badge variant="success">
                    Proxy reachable{proxyTestIp ? ` (${proxyTestIp})` : ""}
                  </Badge>
                )}
                {proxyTestStatus === "failed" && (
                  <Badge variant="danger">{proxyTestError ?? "Unreachable"}</Badge>
                )}
              </div>
            </>
          )}

          <div className="border-t border-border" />

          {/* Linked Trackers */}
          <div className="flex flex-col gap-3">
            <H3>Linked Trackers</H3>
            {proxyTrackers.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {proxyTrackers.map((t) => (
                  <Badge key={t.id} variant="default">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <Paragraph>
                No trackers are using the proxy. Enable it per-tracker in each
                tracker&apos;s settings dialog.
              </Paragraph>
            )}
            <Subtext>
              Toggle proxy usage for individual trackers via their settings dialog
              on the tracker detail page.
            </Subtext>
          </div>
        </Card>
      </section>

      {/* ── Error Log ──────────────────────────────────────────── */}
      <section aria-labelledby="error-log-heading">
        <H2 id="error-log-heading" className="mb-4">Error Log</H2>

        <Card elevation="raised" className="flex flex-col gap-4">
          <Paragraph>
            Copy recent log output to share when reporting issues. Logs stay on your machine — nothing is sent externally.
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
                  const data = await res.json()
                  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load logs")
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

      {/* ── Danger Zone ────────────────────────────────────────── */}
      <section aria-labelledby="danger-heading">
        <H2 id="danger-heading" className="mb-4 !text-danger">Danger Zone</H2>

        <Card elevation="raised" className="flex flex-col gap-6">
          {/* Reset All Stats */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <H3>Reset All Tracker Stats</H3>
              <Paragraph>
                Deletes all tracker snapshots and client snapshots from the database.
                Trackers and their settings are preserved — only historical data is removed.
                Trackers will re-poll on their next scheduled interval.
              </Paragraph>
            </div>

            {confirmResetStats ? (
              <div
                className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim"
              >
                <p className="text-sm font-sans text-primary leading-relaxed">
                  This will permanently delete all snapshot history for every tracker and download client. This cannot be undone.
                </p>
                {resetStatsError && (
                  <p className="text-xs font-sans text-danger" role="alert">{resetStatsError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={resetStatsSubmitting}
                    onClick={async () => {
                      setResetStatsSubmitting(true)
                      setResetStatsError(null)
                      try {
                        const res = await fetch("/api/settings/reset-stats", { method: "POST" })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({ error: "Reset failed" }))
                          throw new Error((data as { error?: string }).error ?? "Reset failed")
                        }
                        setResetStatsSuccess(true)
                        setConfirmResetStats(false)
                      } catch (err) {
                        setResetStatsError(err instanceof Error ? err.message : "Network error")
                      } finally {
                        setResetStatsSubmitting(false)
                      }
                    }}
                  >
                    {resetStatsSubmitting ? "Resetting…" : "Confirm Reset"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfirmResetStats(false)
                      setResetStatsError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => { setConfirmResetStats(true); setResetStatsSuccess(false) }}
                >
                  Reset All Stats
                </Button>
                {resetStatsSuccess && (
                  <span className="text-xs font-sans text-success">All stats have been reset.</span>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Emergency Lockdown */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <H3>Emergency Lockdown</H3>
              <Paragraph>
                Immediately revokes all sessions, stops all tracker polling, and rotates
                the encryption key. You will need to re-enter your master password and
                re-add all tracker API tokens.
              </Paragraph>
            </div>

            {confirmLockdown ? (
              <div
                className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim"
              >
                <p className="text-sm font-sans text-primary leading-relaxed">
                  Confirm you understand the consequences:
                </p>
                <div className="flex flex-col gap-2">
                  <Checkbox
                    checked={lockdownChecks.sessions}
                    onChange={(v) => setLockdownChecks((prev) => ({ ...prev, sessions: v }))}
                  >
                    All active sessions will be revoked immediately
                  </Checkbox>
                  <Checkbox
                    checked={lockdownChecks.tokens}
                    onChange={(v) => setLockdownChecks((prev) => ({ ...prev, tokens: v }))}
                  >
                    All tracker API tokens will be destroyed — I must re-enter them
                  </Checkbox>
                  <Checkbox
                    checked={lockdownChecks.totp}
                    onChange={(v) => setLockdownChecks((prev) => ({ ...prev, totp: v }))}
                  >
                    Two-factor authentication and username will be removed
                  </Checkbox>
                </div>
                {lockdownError && (
                  <p className="text-xs font-sans text-danger" role="alert">{lockdownError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={
                      lockdownSubmitting ||
                      !lockdownChecks.sessions ||
                      !lockdownChecks.tokens ||
                      !lockdownChecks.totp
                    }
                    onClick={async () => {
                      setLockdownSubmitting(true)
                      setLockdownError(null)
                      try {
                        const res = await fetch("/api/settings/lockdown", { method: "POST" })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({ error: "Lockdown failed" }))
                          throw new Error((data as { error?: string }).error ?? "Lockdown failed")
                        }
                        router.push("/login")
                      } catch (err) {
                        setLockdownError(err instanceof Error ? err.message : "Network error")
                        setLockdownSubmitting(false)
                      }
                    }}
                  >
                    {lockdownSubmitting ? "Locking down…" : "Confirm Lockdown"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfirmLockdown(false)
                      setLockdownChecks({ sessions: false, tokens: false, totp: false })
                      setLockdownError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setConfirmLockdown(true)}
                >
                  Initiate Lockdown
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Scrub & Delete */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <H3>Scrub &amp; Delete All Data</H3>
              <Paragraph>
                Permanently deletes all trackers, snapshots, roles, and settings from
                the database. Scrubs all stored API tokens and usernames before deletion.
                The application will reset to first-run setup.
              </Paragraph>
            </div>

            {confirmNuke ? (
              <div
                className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim"
              >
                <p className="text-sm font-sans text-primary leading-relaxed">
                  This will permanently destroy all data. There is no recovery.
                </p>
                <Input
                  type="password"
                  label="Master Password"
                  value={nukePassword}
                  onChange={(e) => {
                    setNukePassword(e.target.value)
                    setNukeError(null)
                  }}
                  placeholder="Enter your master password to confirm"
                  disabled={nukeSubmitting}
                  error={nukeError ?? undefined}
                />
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={nukeSubmitting || !nukePassword.trim()}
                    onClick={async () => {
                      setNukeSubmitting(true)
                      setNukeError(null)
                      try {
                        const res = await fetch("/api/settings/nuke", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ password: nukePassword }),
                        })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({ error: "Delete failed" }))
                          throw new Error((data as { error?: string }).error ?? "Delete failed")
                        }
                        router.push("/setup")
                      } catch (err) {
                        setNukeError(err instanceof Error ? err.message : "Network error")
                        setNukeSubmitting(false)
                      }
                    }}
                  >
                    {nukeSubmitting ? "Scrubbing…" : "Delete Everything"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfirmNuke(false)
                      setNukePassword("")
                      setNukeError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setConfirmNuke(true)}
                >
                  Scrub &amp; Delete
                </Button>
              </div>
            )}
          </div>
        </Card>
      </section>
        </>
      )}

      {activeTab === "clients" && (
        <div className="flex flex-col gap-8">
          <DownloadClients />
          <div className="border-t border-border" />
          <QbitmanageSettings />
        </div>
      )}

      {activeTab === "tag-groups" && (
        <TagGroups />
      )}

      {activeTab === "backups" && (
        <>
      {/* ── Actions ────────────────────────────────────────────── */}
      <section aria-labelledby="backup-actions-heading">
        <H2 id="backup-actions-heading" className="mb-4">Actions</H2>

        <Card elevation="raised" className="flex flex-col gap-4">
          <div className="flex gap-3">
            <Button size="sm" onClick={handleBackupNow} disabled={backingUp}>
              {backingUp ? "Creating Backup…" : "Backup Now"}
            </Button>
          </div>
          <Paragraph>
            Manual backup exports all trackers, snapshots, roles, and settings as a
            single JSON file. The file is saved to the backup volume and downloaded to your browser.
          </Paragraph>

          {/* Restore dropzone */}
          <button
            type="button"
            className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer w-full ${
              isDraggingRestore
                ? "border-accent bg-accent/10"
                : "border-border hover:border-secondary"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingRestore(true) }}
            onDragLeave={() => setIsDraggingRestore(false)}
            onDrop={async (e) => {
              e.preventDefault()
              setIsDraggingRestore(false)
              const file = e.dataTransfer.files[0]
              if (file && (file.name.endsWith(".json") || file.name.endsWith(".ttbak"))) {
                await prepareRestoreFile(file)
              } else {
                setBackupError("Invalid file type. Expected .json or .ttbak")
              }
            }}
            onClick={() => restoreInputRef.current?.click()}
          >
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,.ttbak"
              className="hidden"
              onChange={handleRestoreFileSelect}
            />
            <span className="text-sm text-secondary">
              Drop a backup file here to restore, or click to browse
            </span>
            <span className="text-xs text-tertiary">.json or .ttbak</span>
          </button>

          {backupError && (
            <p className="text-sm text-danger font-mono">{backupError}</p>
          )}
        </Card>
      </section>

      {/* ── Restore Confirmation ──────────────────────────────── */}
      {showRestoreConfirm && (
        <section aria-labelledby="restore-confirm-heading">
          <H2 id="restore-confirm-heading" className="mb-4">Confirm Restore</H2>
          <Card elevation="raised" className="flex flex-col gap-4">
            <div className="p-3 rounded-lg bg-warn/10 border border-warn/30">
              <p className="text-sm text-warn font-sans font-semibold mb-2">
                Restoring will replace <strong>all</strong> current data. This action cannot be undone.
              </p>
              <ul className="text-sm text-warn font-sans space-y-1 ml-4 list-disc">
                <li>Tracker API tokens will be cleared (must re-enter)</li>
                <li>Download client credentials will be cleared (must re-enter)</li>
                <li>TOTP/2FA will be disabled (can re-enable after restore)</li>
                <li>Proxy password will be cleared (must re-enter)</li>
              </ul>
              <p className="text-xs text-warn/80 font-sans mt-2">
                Encrypted secrets stored in your current instance cannot be restored from backups.
              </p>
            </div>
            <p className="text-sm text-secondary font-mono">
              File: {restoreFile?.name}
            </p>
            <Input
              label="Master password"
              type="password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
              data-1p-ignore
              autoComplete="off"
              placeholder="Required to authorize restore"
            />
            {isEncryptedBackup && (
              <Input
                label="Backup password"
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                data-1p-ignore
                autoComplete="off"
                placeholder="Enter backup password"
              />
            )}
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30">
              <Input
                label="Type RESTORE ALL DATA to confirm"
                type="text"
                value={restoreConfirmPhrase}
                onChange={(e) => setRestoreConfirmPhrase(e.target.value)}
                placeholder="RESTORE ALL DATA"
                autoComplete="off"
                className="font-mono"
              />
              <p className="text-xs text-danger/80 mt-2">
                This destructive operation cannot be undone. Type the phrase exactly to proceed.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="danger"
                onClick={handleRestore}
                disabled={
                  restoring ||
                  !restorePassword ||
                  (isEncryptedBackup && !backupPassword) ||
                  restoreConfirmPhrase !== "RESTORE ALL DATA"
                }
              >
                {restoring ? "Restoring…" : "Confirm Restore"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowRestoreConfirm(false)
                  setRestoreFile(null)
                  setRestorePassword("")
                  setBackupPassword("")
                  setRestoreConfirmPhrase("")
                }}
                disabled={restoring}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </section>
      )}

      {/* ── Configuration ──────────────────────────────────────── */}
      <section aria-labelledby="backup-config-heading">
        <H2 id="backup-config-heading" className="mb-4">Configuration</H2>

        <Card elevation="raised" className="flex flex-col gap-5">
          <div>
            <Toggle
              label="Encrypt backups"
              checked={encryptBackups}
              onChange={setEncryptBackups}
              description="Protect manual backup exports with a password. The backup can be restored on any instance with the password."
            />
            {encryptBackups && (
              <div className="mt-4 ml-15">
                <Input
                  label="Backup password"
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Set password for encrypted backups"
                  data-1p-ignore
                  autoComplete="off"
                />
                <p className="text-xs text-secondary font-sans mt-1">
                  This password will be used to encrypt manual backup exports. Store it securely!
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          <Toggle
            label="Schedule automated backups"
            checked={scheduleEnabled}
            onChange={setScheduleEnabled}
            description="Automatically create backups on a recurring schedule at 03:00."
          />

          {scheduleEnabled && (
            <div className="flex flex-col gap-4 ml-15">
              <div className="flex items-start gap-6">
                <div className="w-28">
                  <Select
                    label="Frequency"
                    value={scheduleFrequency}
                    onChange={setScheduleFrequency}
                    ariaLabel="Backup frequency"
                    size="sm"
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                  />
                </div>
                <NumberInput
                  label="Retention"
                  value={backupRetentionCount}
                  onChange={setBackupRetentionCount}
                  min={1}
                  max={365}
                />
              </div>
              <Subtext className="-mt-1">Keep this many scheduled backups before older ones are pruned.</Subtext>
              <Input
                label="Storage path"
                value={backupStoragePath}
                onChange={(e) => setBackupStoragePath(e.target.value)}
                placeholder="/data/backups"
              />
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={saveBackupConfig} disabled={!backupConfigDirty || savingBackupConfig}>
              {savingBackupConfig ? "Saving…" : "Save Configuration"}
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Recent Backups ─────────────────────────────────────── */}
      <section aria-labelledby="backup-history-heading">
        <H2 id="backup-history-heading" className="mb-4">Recent Backups</H2>

        <Table<BackupRecord>
          columns={backupColumns}
          data={backupHistory}
          keyExtractor={(b) => b.id}
          emptyMessage="No backups yet"
        />
      </section>
        </>
      )}
    </div>
  )
}
