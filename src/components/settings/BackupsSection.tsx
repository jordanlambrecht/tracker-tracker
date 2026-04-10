// src/components/settings/BackupsSection.tsx
"use client"

import { H2, Paragraph, Subtext } from "@typography"
import clsx from "clsx"
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Badge,
  Button,
  Card,
  type Column,
  InfoTip,
  Input,
  Notice,
  NumberInput,
  Select,
  Table,
  Toggle,
  Tooltip,
} from "@/components/ui"

import { usePatchSettings } from "@/hooks/usePatchSettings"
import { DOCS } from "@/lib/constants"
import { downloadResponseBlob } from "@/lib/download"
import { extractApiError } from "@/lib/extract-api-error"
import { formatBytesNum, formatDateTime } from "@/lib/formatters"
import { BACKUP_RETENTION_MAX, BACKUP_RETENTION_MIN } from "@/lib/limits"

export interface BackupRecord {
  id: number
  createdAt: string
  sizeBytes: number
  encrypted: boolean
  frequency: string | null
  status: string
  hasStoredFile: boolean
  notes: string | null
}

interface BackupsSectionProps {
  initialConfig: {
    encryptBackups: boolean
    hasBackupPassword: boolean
    scheduleEnabled: boolean
    scheduleFrequency: string
    backupRetentionCount: number
    backupStoragePath: string
  }
}

export function BackupsSection({ initialConfig }: BackupsSectionProps) {
  const [encryptBackups, setEncryptBackups] = useState(initialConfig.encryptBackups)
  const [hasStoredPassword, setHasStoredPassword] = useState(initialConfig.hasBackupPassword)
  const [newBackupPassword, setNewBackupPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(initialConfig.scheduleEnabled)
  const [scheduleFrequency, setScheduleFrequency] = useState(initialConfig.scheduleFrequency)
  const [backupRetentionCount, setBackupRetentionCount] = useState(
    initialConfig.backupRetentionCount
  )
  const [backupStoragePath, setBackupStoragePath] = useState(initialConfig.backupStoragePath)
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([])
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [savedBackupConfig, setSavedBackupConfig] = useState({
    encryptBackups: initialConfig.encryptBackups,
    scheduleEnabled: initialConfig.scheduleEnabled,
    scheduleFrequency: initialConfig.scheduleFrequency,
    backupRetentionCount: initialConfig.backupRetentionCount,
    backupStoragePath: initialConfig.backupStoragePath,
  })
  const [restorePassword, setRestorePassword] = useState("")
  const [backupPassword, setBackupPassword] = useState("")
  const [restoreConfirmPhrase, setRestoreConfirmPhrase] = useState("")
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [isEncryptedBackup, setIsEncryptedBackup] = useState(false)
  const [deletingBackupId, setDeletingBackupId] = useState<number | null>(null)
  const [isDraggingRestore, setIsDraggingRestore] = useState(false)
  const [totpWasDisabled, setTotpWasDisabled] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const { saving: savingBackupConfig, patch: patchSettings } = usePatchSettings()

  useEffect(() => {
    if (sessionStorage.getItem("totp_disabled_on_restore") === "1") {
      setTotpWasDisabled(true)
      sessionStorage.removeItem("totp_disabled_on_restore")
    }
  }, [])

  useEffect(() => {
    fetch("/api/settings/backup/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BackupRecord[] | null) => {
        if (data) setBackupHistory(data)
      })
      .catch(() => {})
  }, [])

  const backupConfigDirty =
    encryptBackups !== savedBackupConfig.encryptBackups ||
    scheduleEnabled !== savedBackupConfig.scheduleEnabled ||
    scheduleFrequency !== savedBackupConfig.scheduleFrequency ||
    backupRetentionCount !== savedBackupConfig.backupRetentionCount ||
    backupStoragePath !== savedBackupConfig.backupStoragePath

  async function handleBackupNow() {
    if (encryptBackups && !hasStoredPassword) {
      setBackupError("Set a backup password in Configuration before exporting")
      return
    }
    setBackingUp(true)
    setBackupError(null)
    try {
      const res = await fetch("/api/settings/backup/export", {
        method: "POST",
        body: new FormData(),
      })
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Export failed"))
      }

      const contentType = res.headers.get("Content-Type") ?? ""
      if (!contentType.includes("application/json")) {
        await downloadResponseBlob(res, `tracker-tracker-backup-${Date.now()}.json`)
      }

      const histRes = await fetch("/api/settings/backup/history")
      if (histRes.ok) setBackupHistory(await histRes.json())
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setBackingUp(false)
    }
  }

  async function handleSaveBackupPassword() {
    if (!newBackupPassword) return
    setSavingPassword(true)
    setBackupError(null)
    const result = await patchSettings({ backupPassword: newBackupPassword })
    if (!result.ok) {
      setBackupError(result.error)
    } else {
      setHasStoredPassword(true)
      setNewBackupPassword("")
    }
    setSavingPassword(false)
  }

  async function handleClearBackupPassword() {
    setSavingPassword(true)
    setBackupError(null)
    const result = await patchSettings({ backupPassword: null })
    if (!result.ok) {
      setBackupError(result.error)
    } else {
      setHasStoredPassword(false)
      setNewBackupPassword("")
    }
    setSavingPassword(false)
  }

  async function handleRestoreFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    await prepareRestoreFile(file)
  }

  async function prepareRestoreFile(file: File | null) {
    setRestoreFile(file)
    if (file) {
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const isEncrypted = json.format === "tracker-tracker-encrypted-backup"
        setIsEncryptedBackup(isEncrypted)
      } catch {
        setIsEncryptedBackup(false)
      }
      setShowRestoreConfirm(true)
      setRestorePassword("")
      setBackupPassword("")
      setBackupError(null)
    }
  }

  async function handleRestore() {
    if (!restoreFile) return
    if (!restorePassword) return
    if (isEncryptedBackup && !backupPassword) return
    setRestoring(true)
    setBackupError(null)
    try {
      const formData = new FormData()
      formData.append("file", restoreFile)
      formData.append("masterPassword", restorePassword)
      if (isEncryptedBackup && backupPassword) {
        formData.append("backupPassword", backupPassword)
      }
      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Restore failed")
      }
      if ((data as { totpDisabledOnRestore?: boolean }).totpDisabledOnRestore) {
        sessionStorage.setItem("totp_disabled_on_restore", "1")
      }
      setShowRestoreConfirm(false)
      setRestoreFile(null)
      setRestorePassword("")
      setBackupPassword("")
      setRestoreConfirmPhrase("")
      window.location.reload()
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Restore failed")
    } finally {
      setRestoring(false)
    }
  }

  const handleDownloadBackup = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/settings/backup/${id}`)
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Download failed"))
      }
      await downloadResponseBlob(res, `tracker-tracker-backup-${id}.json`)
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Download failed")
    }
  }, [])

  const handleDeleteBackup = useCallback(async (id: number) => {
    setDeletingBackupId(id)
    try {
      const res = await fetch(`/api/settings/backup/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        setBackupError("Failed to delete backup")
        return
      }
      setBackupHistory((prev) => prev.filter((b) => b.id !== id))
    } catch {
      setBackupError("Failed to delete backup")
    } finally {
      setDeletingBackupId(null)
    }
  }, [])

  async function saveBackupConfig() {
    const result = await patchSettings({
      backupEncryptionEnabled: encryptBackups,
      backupScheduleEnabled: scheduleEnabled,
      backupScheduleFrequency: scheduleFrequency,
      backupRetentionCount: backupRetentionCount,
      backupStoragePath: backupStoragePath || null,
    })
    if (result !== null) {
      setSavedBackupConfig({
        encryptBackups,
        scheduleEnabled,
        scheduleFrequency,
        backupRetentionCount,
        backupStoragePath,
      })
    }
  }

  const backupColumns: Column<BackupRecord>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (b) => (
          <span className="text-sm font-mono text-primary tabular-nums">
            {formatDateTime(b.createdAt)}
            {b.encrypted && (
              <Tooltip content="Password-protected">
                <span className="ml-2 text-xs text-accent">🔒</span>
              </Tooltip>
            )}
          </span>
        ),
      },
      {
        key: "size",
        header: "Size",
        render: (b) => (
          <span className="text-sm font-mono text-tertiary tabular-nums">
            {formatBytesNum(b.sizeBytes)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (b) => (
          <Badge variant={b.status === "completed" ? "success" : "danger"}>{b.status}</Badge>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        render: (b) => (
          <div className="flex gap-2 justify-end">
            {b.hasStoredFile && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownloadBackup(b.id)}
                text="Download"
              />
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
    ],
    [deletingBackupId, handleDownloadBackup, handleDeleteBackup]
  )

  return (
    <>
      {totpWasDisabled && (
        <Notice variant="warn" className="mb-4" header="Two-factor authentication disabled">
          This happened during restore because the backup predated your TOTP setup. Re-enable it in
          the Security tab to restore 2FA protection.
        </Notice>
      )}

      {/* ── Export ──────────────────────────────────────────────── */}
      <section aria-labelledby="backup-export-heading">
        <H2 id="backup-export-heading" className="mb-4 flex items-center gap-2">
          Export
          <InfoTip
            content="Export and restore your trackers, settings, and snapshots."
            docs={DOCS.BACKUPS}
          />
        </H2>

        <Card elevation="raised" className="flex flex-col gap-4">
          <div className="flex gap-3 items-center">
            <Button
              size="sm"
              onClick={handleBackupNow}
              disabled={backingUp || backupConfigDirty}
              text={backingUp ? "Creating Backup…" : "Backup Now"}
            />
            {backupConfigDirty && (
              <Notice variant="warn" message="Save configuration before exporting" />
            )}
            {!backupConfigDirty && encryptBackups && !hasStoredPassword && (
              <Notice variant="warn" message="Set a backup password in Configuration first" />
            )}
            {!backupConfigDirty && encryptBackups && hasStoredPassword && (
              <Notice variant="success" message="Password-protected" />
            )}
          </div>
          <Paragraph>
            Manual backup exports all trackers, snapshots, roles, and settings as a single file.{" "}
            {backupStoragePath ? `Saved to ${backupStoragePath}.` : "Downloaded to your browser."}
          </Paragraph>

          <Notice message={backupError} />
        </Card>
      </section>

      {/* ── Restore ────────────────────────────────────────────── */}
      <section aria-labelledby="restore-heading">
        <H2 id="restore-heading" className="mb-4">
          Restore
        </H2>

        <Card elevation="raised" className="flex flex-col gap-4">
          <button
            type="button"
            className={clsx(
              "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer w-full",
              isDraggingRestore
                ? "border-accent bg-accent/10"
                : "border-border hover:border-secondary"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingRestore(true)
            }}
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

          <Notice message={backupError} />
        </Card>
      </section>

      {/* ── Restore Confirmation ──────────────────────────────── */}
      {showRestoreConfirm && (
        <section aria-labelledby="restore-confirm-heading">
          <H2 id="restore-confirm-heading" className="mb-4">
            Confirm Restore
          </H2>
          <Card elevation="raised" className="flex flex-col gap-4">
            <Notice
              variant="warn"
              box
              header="Restoring will replace all current data. This action cannot be undone."
            >
              <ul className="space-y-1 ml-4 list-disc">
                <li>Tracker API tokens will be cleared (must re-enter)</li>
                <li>Download client credentials will be cleared (must re-enter)</li>
                <li>TOTP/2FA will be disabled (can re-enable after restore)</li>
                <li>Proxy password will be cleared (must re-enter)</li>
              </ul>
              <p className="text-xs opacity-70 mt-1">
                Encrypted secrets stored in your current instance cannot be restored from backups.
              </p>
            </Notice>
            <p className="text-sm text-secondary font-mono">File: {restoreFile?.name}</p>
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
            <Notice variant="danger" box showIcon={false}>
              <Input
                label="Type RESTORE ALL DATA to confirm"
                type="text"
                value={restoreConfirmPhrase}
                onChange={(e) => setRestoreConfirmPhrase(e.target.value)}
                placeholder="RESTORE ALL DATA"
                autoComplete="off"
                className="font-mono"
                hint="This destructive operation cannot be undone. Type the phrase exactly to proceed."
                hintVariant="danger"
              />
            </Notice>
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
                text={restoring ? "Restoring…" : "Confirm Restore"}
              />
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
                text="Cancel"
              />
            </div>
          </Card>
        </section>
      )}

      {/* ── Configuration ──────────────────────────────────────── */}
      <section aria-labelledby="backup-config-heading">
        <H2 id="backup-config-heading" className="mb-4">
          Configuration
        </H2>

        <Card elevation="raised" className="flex flex-col gap-5">
          <Toggle
            label="Password-protect backups"
            checked={encryptBackups}
            onChange={(val) => {
              setEncryptBackups(val)
              if (!val) {
                setHasStoredPassword(false)
                setNewBackupPassword("")
              }
            }}
            description="Encrypt all backups (manual and scheduled) with a password. You'll need this password to restore from a protected backup."
          />

          {encryptBackups && (
            <div className="flex flex-col gap-3">
              {hasStoredPassword ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-success font-mono">Password is set</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleClearBackupPassword}
                    disabled={savingPassword}
                    text="Clear"
                  />
                </div>
              ) : (
                <Notice
                  variant="warn"
                  message="No password set. Backups will not be encrypted until a password is saved."
                />
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label={hasStoredPassword ? "Change password" : "Set password"}
                    type="password"
                    value={newBackupPassword}
                    onChange={(e) => setNewBackupPassword(e.target.value)}
                    placeholder={hasStoredPassword ? "Enter new password" : "Enter backup password"}
                    data-1p-ignore
                    autoComplete="off"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveBackupPassword}
                  disabled={!newBackupPassword || savingPassword}
                  text={savingPassword ? "Saving…" : "Save Password"}
                />
              </div>
            </div>
          )}

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
                  min={BACKUP_RETENTION_MIN}
                  max={BACKUP_RETENTION_MAX}
                />
              </div>
              <Subtext className="-mt-1">
                Keep this many scheduled backups before older ones are pruned.
              </Subtext>
            </div>
          )}

          <div className="border-t border-border" />

          <div>
            <Input
              label="Storage path"
              value={backupStoragePath}
              onChange={(e) => setBackupStoragePath(e.target.value)}
              placeholder="/data/backups"
            />
            <Subtext className="mt-1">
              Absolute path where backups are saved. Used by both manual exports and scheduled
              backups.
            </Subtext>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={saveBackupConfig}
              disabled={!backupConfigDirty || savingBackupConfig}
              text={savingBackupConfig ? "Saving…" : "Save Configuration"}
            />
          </div>
        </Card>
      </section>

      {/* ── Recent Backups ─────────────────────────────────────── */}
      <section aria-labelledby="backup-history-heading">
        <H2 id="backup-history-heading" className="mb-4">
          Recent Backups
        </H2>

        <Table<BackupRecord>
          columns={backupColumns}
          data={backupHistory}
          keyExtractor={(b) => b.id}
          emptyMessage="No backups yet"
        />
      </section>
    </>
  )
}
