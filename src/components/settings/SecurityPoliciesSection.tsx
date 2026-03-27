// src/components/settings/SecurityPoliciesSection.tsx
//
// Functions: SecurityPoliciesSection

"use client"

import { Paragraph } from "@typography"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button } from "@/components/ui/Button"
import { Checkbox } from "@/components/ui/Checkbox"
import { NumberInput } from "@/components/ui/NumberInput"
import { usePatchSettings } from "@/hooks/usePatchSettings"

interface LockoutConfig {
  enabled: boolean
  threshold: number
  durationMinutes: number
}

export interface SecurityPoliciesSectionProps {
  initialLockout: LockoutConfig
  initialSnapshotRetentionDays: number | null
  initialSessionTimeoutMinutes: number | null
  databaseSize?: string
}

export function SecurityPoliciesSection({
  initialLockout,
  initialSnapshotRetentionDays,
  initialSessionTimeoutMinutes,
  databaseSize,
}: SecurityPoliciesSectionProps) {
  // ── Auto-lockout ───────────────────────────────────────────────────
  const [lockoutEnabled, setLockoutEnabled] = useState(initialLockout.enabled)
  const [lockoutThreshold, setLockoutThreshold] = useState(initialLockout.threshold)
  const [lockoutDuration, setLockoutDuration] = useState(initialLockout.durationMinutes)
  const [savedLockout, setSavedLockout] = useState<LockoutConfig>({ ...initialLockout })

  const {
    saving: savingLockout,
    error: lockoutError,
    success: lockoutSuccess,
    patch: patchLockout,
    clearSuccess: clearLockoutSuccess,
  } = usePatchSettings()

  // ── Snapshot retention ─────────────────────────────────────────────
  const [retentionEnabled, setRetentionEnabled] = useState(
    initialSnapshotRetentionDays !== null && initialSnapshotRetentionDays > 0
  )
  const [retentionDays, setRetentionDays] = useState(
    initialSnapshotRetentionDays && initialSnapshotRetentionDays > 0
      ? initialSnapshotRetentionDays
      : 90
  )
  const [savedRetention, setSavedRetention] = useState<{
    enabled: boolean
    days: number
  }>({
    enabled: initialSnapshotRetentionDays !== null && initialSnapshotRetentionDays > 0,
    days:
      initialSnapshotRetentionDays && initialSnapshotRetentionDays > 0
        ? initialSnapshotRetentionDays
        : 90,
  })

  const {
    saving: savingRetention,
    error: retentionError,
    success: retentionSuccess,
    patch: patchRetention,
    clearSuccess: clearRetentionSuccess,
  } = usePatchSettings()

  // ── Session timeout ────────────────────────────────────────────────
  const resolveInitialTimeout = (
    totalMinutes: number | null
  ): { enabled: boolean; days: number; hours: number; minutes: number } => {
    if (!totalMinutes || totalMinutes <= 0) {
      return { enabled: false, days: 0, hours: 1, minutes: 0 }
    }
    return {
      enabled: true,
      days: Math.floor(totalMinutes / 1440),
      hours: Math.floor((totalMinutes % 1440) / 60),
      minutes: totalMinutes % 60,
    }
  }

  const initTimeout = resolveInitialTimeout(initialSessionTimeoutMinutes)

  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(initTimeout.enabled)
  const [autoLogoutDays, setAutoLogoutDays] = useState(initTimeout.days)
  const [autoLogoutHours, setAutoLogoutHours] = useState(initTimeout.hours)
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(initTimeout.minutes)
  const [savedTimeoutMinutes, setSavedTimeoutMinutes] = useState<number | null>(
    initialSessionTimeoutMinutes
  )

  const {
    saving: savingTimeout,
    error: timeoutError,
    success: timeoutSuccess,
    patch: patchTimeout,
    clearSuccess: clearTimeoutSuccess,
  } = usePatchSettings()

  // ── Handlers ───────────────────────────────────────────────────────
  async function handleSaveLockout() {
    const result = await patchLockout({
      lockoutEnabled,
      lockoutThreshold,
      lockoutDurationMinutes: lockoutDuration,
    })
    if (result !== null) {
      const r = result as {
        lockoutEnabled: boolean
        lockoutThreshold: number
        lockoutDurationMinutes: number
      }
      setSavedLockout({
        enabled: r.lockoutEnabled,
        threshold: r.lockoutThreshold,
        durationMinutes: r.lockoutDurationMinutes,
      })
    }
  }

  async function handleSaveRetention() {
    const value = retentionEnabled ? retentionDays : null
    const result = await patchRetention({ snapshotRetentionDays: value })
    if (result !== null) {
      const saved =
        (result as { snapshotRetentionDays?: number | null }).snapshotRetentionDays ?? null
      setSavedRetention({
        enabled: saved !== null && saved > 0,
        days: saved ?? 90,
      })
    }
  }

  async function handleSaveTimeout() {
    const currentTotal = autoLogoutEnabled
      ? autoLogoutDays * 1440 + autoLogoutHours * 60 + autoLogoutMinutes
      : 0
    const currentValue = currentTotal > 0 ? currentTotal : null
    const result = await patchTimeout({ sessionTimeoutMinutes: currentValue })
    if (result !== null) {
      const saved =
        (result as { sessionTimeoutMinutes?: number | null }).sessionTimeoutMinutes ?? null
      setSavedTimeoutMinutes(saved)
    }
  }

  // ── Dirty checks ───────────────────────────────────────────────────
  const lockoutDirty =
    lockoutEnabled !== savedLockout.enabled ||
    lockoutThreshold !== savedLockout.threshold ||
    lockoutDuration !== savedLockout.durationMinutes

  const retentionDirty =
    retentionEnabled !== savedRetention.enabled ||
    (retentionEnabled && retentionDays !== savedRetention.days)

  const currentTimeoutTotal = autoLogoutEnabled
    ? autoLogoutDays * 1440 + autoLogoutHours * 60 + autoLogoutMinutes
    : 0
  const currentTimeoutValue = currentTimeoutTotal > 0 ? currentTimeoutTotal : null
  const timeoutDirty = currentTimeoutValue !== savedTimeoutMinutes

  return (
    <SettingsSection
      id="security-policies"
      title="Security Policies"
      cardClassName="flex flex-col gap-5"
    >
      {/* Auto-lockout */}
      <div className="flex flex-col gap-3">
        <Checkbox
          checked={lockoutEnabled}
          onChange={(v) => {
            setLockoutEnabled(v)
            clearLockoutSuccess()
          }}
        >
          Lock account after{" "}
          <NumberInput
            value={lockoutThreshold}
            onChange={(v) => {
              setLockoutThreshold(v)
              clearLockoutSuccess()
            }}
            min={1}
            max={99}
            disabled={!lockoutEnabled}
            className="mx-1 inline-flex align-middle"
          />{" "}
          failed attempts for{" "}
          <NumberInput
            value={lockoutDuration}
            onChange={(v) => {
              setLockoutDuration(v)
              clearLockoutSuccess()
            }}
            min={1}
            max={1440}
            disabled={!lockoutEnabled}
            className="mx-1 inline-flex align-middle"
          />{" "}
          minutes
        </Checkbox>
        <Paragraph className="ml-8">
          Temporarily locks the login page after consecutive failed attempts. Protects against
          brute-force attacks. The lockout resets on successful login.
        </Paragraph>
        {lockoutError && (
          <p className="text-xs font-sans text-danger ml-8" role="alert">
            {lockoutError}
          </p>
        )}
        {lockoutSuccess && (
          <p className="text-xs font-sans text-success ml-8">Lockout setting saved.</p>
        )}
        {lockoutDirty && (
          <div className="flex justify-end">
            <Button size="sm" disabled={savingLockout} onClick={handleSaveLockout}>
              {savingLockout ? "Saving…" : "Save Lockout"}
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Snapshot data retention */}
      <div className="flex flex-col gap-3">
        <Checkbox
          checked={retentionEnabled}
          onChange={(v) => {
            setRetentionEnabled(v)
            clearRetentionSuccess()
          }}
        >
          Auto-delete snapshots older than{" "}
          <NumberInput
            value={retentionDays}
            onChange={(v) => {
              setRetentionDays(v)
              clearRetentionSuccess()
            }}
            min={7}
            max={3650}
            disabled={!retentionEnabled}
            className="mx-1 inline-flex align-middle"
          />{" "}
          days
        </Checkbox>
        <Paragraph className="ml-8">
          Automatically prunes historical snapshot data older than the configured period. Reduces
          what&apos;s stored on disk.
        </Paragraph>
        {databaseSize && (
          <p className="text-xs font-mono text-tertiary ml-8">
            Current database size: {databaseSize}
          </p>
        )}
        {retentionError && (
          <p className="text-xs font-sans text-danger ml-8" role="alert">
            {retentionError}
          </p>
        )}
        {retentionSuccess && (
          <p className="text-xs font-sans text-success ml-8">Retention setting saved.</p>
        )}
        {retentionDirty && (
          <div className="flex justify-end">
            <Button size="sm" disabled={savingRetention} onClick={handleSaveRetention}>
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
            clearTimeoutSuccess()
          }}
        >
          Auto log out after{" "}
          <NumberInput
            value={autoLogoutDays}
            onChange={(v) => {
              setAutoLogoutDays(v)
              clearTimeoutSuccess()
            }}
            min={0}
            max={365}
            disabled={!autoLogoutEnabled}
            className="mx-1 inline-flex align-middle"
          />{" "}
          days{" "}
          <NumberInput
            value={autoLogoutHours}
            onChange={(v) => {
              setAutoLogoutHours(v)
              clearTimeoutSuccess()
            }}
            min={0}
            max={23}
            disabled={!autoLogoutEnabled}
            className="mx-1 inline-flex align-middle"
          />{" "}
          hours{" "}
          <NumberInput
            value={autoLogoutMinutes}
            onChange={(v) => {
              setAutoLogoutMinutes(v)
              clearTimeoutSuccess()
            }}
            min={0}
            max={59}
            disabled={!autoLogoutEnabled}
            className="mx-1 inline-flex align-middle"
          />{" "}
          minutes
        </Checkbox>
        <Paragraph className="ml-8">
          Automatically ends your session after a period of inactivity.
        </Paragraph>
        {autoLogoutEnabled &&
          autoLogoutDays === 0 &&
          autoLogoutHours === 0 &&
          autoLogoutMinutes === 0 && (
            <p className="text-xs font-sans leading-relaxed ml-8 text-warn">
              All values are zero — auto-logout is effectively disabled.
            </p>
          )}
        {timeoutError && (
          <p className="text-xs font-sans text-danger ml-8" role="alert">
            {timeoutError}
          </p>
        )}
        {timeoutSuccess && (
          <p className="text-xs font-sans text-success ml-8">
            Session timeout saved. Takes effect on next page load.
          </p>
        )}
        {timeoutDirty && (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={savingTimeout || (autoLogoutEnabled && currentTimeoutTotal === 0)}
              onClick={handleSaveTimeout}
            >
              {savingTimeout ? "Saving…" : "Save Timeout"}
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}
