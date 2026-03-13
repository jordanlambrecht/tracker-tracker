// src/components/settings/SecuritySection.tsx
//
// Functions: SecuritySection

"use client"

import { useState } from "react"
import { TwoFactorSetup } from "@/components/TwoFactorSetup"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Checkbox } from "@/components/ui/Checkbox"
import { NumberInput } from "@/components/ui/NumberInput"
import { H2, Paragraph } from "@/components/ui/Typography"
import { usePatchSettings } from "@/hooks/usePatchSettings"

export interface SecuritySectionProps {
  initialAutoWipeThreshold: number | null
  initialSnapshotRetentionDays: number | null
  initialSessionTimeoutMinutes: number | null
}

export function SecuritySection({
  initialAutoWipeThreshold,
  initialSnapshotRetentionDays,
  initialSessionTimeoutMinutes,
}: SecuritySectionProps) {
  // ── Auto-wipe ──────────────────────────────────────────────────────
  const [autoWipeEnabled, setAutoWipeEnabled] = useState(
    initialAutoWipeThreshold !== null && initialAutoWipeThreshold > 0,
  )
  const [autoWipeThreshold, setAutoWipeThreshold] = useState(
    initialAutoWipeThreshold && initialAutoWipeThreshold > 0
      ? initialAutoWipeThreshold
      : 5,
  )
  const [savedAutoWipe, setSavedAutoWipe] = useState<{
    enabled: boolean
    threshold: number
  }>({
    enabled: initialAutoWipeThreshold !== null && initialAutoWipeThreshold > 0,
    threshold:
      initialAutoWipeThreshold && initialAutoWipeThreshold > 0
        ? initialAutoWipeThreshold
        : 5,
  })

  const {
    saving: savingAutoWipe,
    error: autoWipeError,
    success: autoWipeSuccess,
    patch: patchAutoWipe,
    clearSuccess: clearAutoWipeSuccess,
  } = usePatchSettings()

  // ── Snapshot retention ─────────────────────────────────────────────
  const [retentionEnabled, setRetentionEnabled] = useState(
    initialSnapshotRetentionDays !== null && initialSnapshotRetentionDays > 0,
  )
  const [retentionDays, setRetentionDays] = useState(
    initialSnapshotRetentionDays && initialSnapshotRetentionDays > 0
      ? initialSnapshotRetentionDays
      : 90,
  )
  const [savedRetention, setSavedRetention] = useState<{
    enabled: boolean
    days: number
  }>({
    enabled:
      initialSnapshotRetentionDays !== null &&
      initialSnapshotRetentionDays > 0,
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
    totalMinutes: number | null,
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
    initialSessionTimeoutMinutes,
  )

  const {
    saving: savingTimeout,
    error: timeoutError,
    success: timeoutSuccess,
    patch: patchTimeout,
    clearSuccess: clearTimeoutSuccess,
  } = usePatchSettings()

  // ── Handlers ───────────────────────────────────────────────────────
  async function handleSaveAutoWipe() {
    const value = autoWipeEnabled ? autoWipeThreshold : null
    const result = await patchAutoWipe({ autoWipeThreshold: value })
    if (result !== null) {
      const saved = (result as { autoWipeThreshold?: number | null })
        .autoWipeThreshold ?? null
      setSavedAutoWipe({
        enabled: saved !== null && saved > 0,
        threshold: saved ?? 5,
      })
    }
  }

  async function handleSaveRetention() {
    const value = retentionEnabled ? retentionDays : null
    const result = await patchRetention({ snapshotRetentionDays: value })
    if (result !== null) {
      const saved = (result as { snapshotRetentionDays?: number | null })
        .snapshotRetentionDays ?? null
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
      const saved = (result as { sessionTimeoutMinutes?: number | null })
        .sessionTimeoutMinutes ?? null
      setSavedTimeoutMinutes(saved)
    }
  }

  // ── Dirty checks ───────────────────────────────────────────────────
  const autoWipeDirty =
    autoWipeEnabled !== savedAutoWipe.enabled ||
    (autoWipeEnabled && autoWipeThreshold !== savedAutoWipe.threshold)

  const retentionDirty =
    retentionEnabled !== savedRetention.enabled ||
    (retentionEnabled && retentionDays !== savedRetention.days)

  const currentTimeoutTotal = autoLogoutEnabled
    ? autoLogoutDays * 1440 + autoLogoutHours * 60 + autoLogoutMinutes
    : 0
  const currentTimeoutValue = currentTimeoutTotal > 0 ? currentTimeoutTotal : null
  const timeoutDirty = currentTimeoutValue !== savedTimeoutMinutes

  return (
    <>
      {/* ── Two-Factor Authentication ──────────────────────────────── */}
      <section aria-labelledby="2fa-heading">
        <H2 id="2fa-heading" className="mb-4">
          Two-Factor Authentication
        </H2>

        <Card elevation="raised">
          <TwoFactorSetup />
        </Card>
      </section>

      {/* ── Security Policies ──────────────────────────────────────── */}
      <section aria-labelledby="security-policies-heading">
        <H2 id="security-policies-heading" className="mb-4">
          Security Policies
        </H2>

        <Card elevation="raised" className="flex flex-col gap-5">
          {/* Auto-wipe on failed logins */}
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={autoWipeEnabled}
              onChange={(v) => {
                setAutoWipeEnabled(v)
                clearAutoWipeSuccess()
              }}
            >
              Delete all data after{" "}
              <NumberInput
                value={autoWipeThreshold}
                onChange={(v) => {
                  setAutoWipeThreshold(v)
                  clearAutoWipeSuccess()
                }}
                min={1}
                max={99}
                disabled={!autoWipeEnabled}
                className="mx-1 inline-flex align-middle"
              />{" "}
              failed login attempts
            </Checkbox>
            <Paragraph className="ml-8">
              Automatically scrubs and deletes all trackers, snapshots, and
              settings after consecutive failed login attempts. The application
              resets to first-run setup.
            </Paragraph>
            {autoWipeEnabled && (
              <p className="text-xs font-sans leading-relaxed ml-8 text-warn">
                Mistyping your password {autoWipeThreshold} time
                {autoWipeThreshold === 1 ? "" : "s"} in a row will permanently
                destroy all data.
              </p>
            )}
            {autoWipeError && (
              <p className="text-xs font-sans text-danger ml-8" role="alert">
                {autoWipeError}
              </p>
            )}
            {autoWipeSuccess && (
              <p className="text-xs font-sans text-success ml-8">
                Auto-wipe setting saved.
              </p>
            )}
            {autoWipeDirty && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={savingAutoWipe}
                  onClick={handleSaveAutoWipe}
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
              Automatically prunes historical snapshot data older than the
              configured period. Reduces what&apos;s stored on disk. Disabled
              means data is kept indefinitely.
            </Paragraph>
            {retentionError && (
              <p className="text-xs font-sans text-danger ml-8" role="alert">
                {retentionError}
              </p>
            )}
            {retentionSuccess && (
              <p className="text-xs font-sans text-success ml-8">
                Retention setting saved.
              </p>
            )}
            {retentionDirty && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={savingRetention}
                  onClick={handleSaveRetention}
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
              Automatically ends your session after a period of inactivity. You
              will need to log in again with your master password.
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
                  disabled={
                    savingTimeout ||
                    (autoLogoutEnabled && currentTimeoutTotal === 0)
                  }
                  onClick={handleSaveTimeout}
                >
                  {savingTimeout ? "Saving…" : "Save Timeout"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </section>
    </>
  )
}
