// src/components/settings/DangerZoneSection.tsx
"use client"

import { H3, Paragraph } from "@typography"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button } from "@/components/ui/Button"
import { Checkbox } from "@/components/ui/Checkbox"
import { Input } from "@/components/ui/Input"
import { extractApiError } from "@/lib/helpers"

export function DangerZoneSection() {
  const router = useRouter()

  // --- Reset Stats ---
  const [confirmResetStats, setConfirmResetStats] = useState(false)
  const [resetStatsPassword, setResetStatsPassword] = useState("")
  const [resetStatsSubmitting, setResetStatsSubmitting] = useState(false)
  const [resetStatsError, setResetStatsError] = useState<string | null>(null)
  const [resetStatsSuccess, setResetStatsSuccess] = useState(false)

  // --- Emergency Lockdown ---
  const [confirmLockdown, setConfirmLockdown] = useState(false)
  const [lockdownPassword, setLockdownPassword] = useState("")
  const [lockdownChecks, setLockdownChecks] = useState({
    sessions: false,
    tokens: false,
    totp: false,
  })
  const [lockdownSubmitting, setLockdownSubmitting] = useState(false)
  const [lockdownError, setLockdownError] = useState<string | null>(null)

  // --- Nuke ---
  const [confirmNuke, setConfirmNuke] = useState(false)
  const [nukePassword, setNukePassword] = useState("")
  const [nukeSubmitting, setNukeSubmitting] = useState(false)
  const [nukeError, setNukeError] = useState<string | null>(null)

  async function handleResetStats() {
    setResetStatsSubmitting(true)
    setResetStatsError(null)
    try {
      const res = await fetch("/api/settings/reset-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetStatsPassword }),
      })
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Reset failed"))
      }
      setResetStatsSuccess(true)
      setConfirmResetStats(false)
      setResetStatsPassword("")
    } catch (err) {
      setResetStatsError(err instanceof Error ? err.message : "Network error")
    } finally {
      setResetStatsSubmitting(false)
    }
  }

  async function handleLockdown() {
    setLockdownSubmitting(true)
    setLockdownError(null)
    try {
      const res = await fetch("/api/settings/lockdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: lockdownPassword }),
      })
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Lockdown failed"))
      }
      router.push("/login")
    } catch (err) {
      setLockdownError(err instanceof Error ? err.message : "Network error")
      setLockdownSubmitting(false)
    }
  }

  async function handleNuke() {
    setNukeSubmitting(true)
    setNukeError(null)
    try {
      const res = await fetch("/api/settings/nuke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nukePassword }),
      })
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Delete failed"))
      }
      router.push("/setup")
    } catch (err) {
      setNukeError(err instanceof Error ? err.message : "Network error")
      setNukeSubmitting(false)
    }
  }

  return (
    <SettingsSection
      id="danger"
      title="Danger Zone"
      headingClassName="!text-danger"
      cardClassName="flex flex-col gap-6"
    >
      {/* Reset All Stats */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <H3>Reset All Tracker Stats</H3>
          <Paragraph>
            Deletes all tracker snapshots and client snapshots from the database. Trackers and their
            settings are preserved — only historical data is removed. Trackers will re-poll on their
            next scheduled interval.
          </Paragraph>
        </div>

        {confirmResetStats ? (
          <div className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim">
            <p className="text-sm font-sans text-primary leading-relaxed">
              This will permanently delete all snapshot history for every tracker and download
              client. This cannot be undone.
            </p>
            <Input
              type="password"
              autoComplete="off"
              data-1p-ignore
              label="Master Password"
              value={resetStatsPassword}
              onChange={(e) => {
                setResetStatsPassword(e.target.value)
                setResetStatsError(null)
              }}
              placeholder="Enter your master password to confirm"
              disabled={resetStatsSubmitting}
              error={resetStatsError ?? undefined}
            />
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="danger"
                disabled={resetStatsSubmitting || !resetStatsPassword.trim()}
                onClick={handleResetStats}
                text={resetStatsSubmitting ? "Resetting…" : "Confirm Reset"}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmResetStats(false)
                  setResetStatsPassword("")
                  setResetStatsError(null)
                }}
                text="Cancel"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setConfirmResetStats(true)
                setResetStatsSuccess(false)
              }}
              text="Reset All Stats"
            />
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
            Immediately revokes all sessions, stops all tracker polling, and rotates the encryption
            key. You will need to re-enter your master password and re-add all tracker API tokens.
          </Paragraph>
        </div>

        {confirmLockdown ? (
          <div className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim">
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
            <Input
              type="password"
              autoComplete="off"
              data-1p-ignore
              label="Master Password"
              value={lockdownPassword}
              onChange={(e) => {
                setLockdownPassword(e.target.value)
                setLockdownError(null)
              }}
              placeholder="Enter your master password to confirm"
              disabled={lockdownSubmitting}
              error={lockdownError ?? undefined}
            />
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="danger"
                disabled={
                  lockdownSubmitting ||
                  !lockdownChecks.sessions ||
                  !lockdownChecks.tokens ||
                  !lockdownChecks.totp ||
                  !lockdownPassword.trim()
                }
                onClick={handleLockdown}
                text={lockdownSubmitting ? "Locking down…" : "Confirm Lockdown"}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmLockdown(false)
                  setLockdownPassword("")
                  setLockdownChecks({ sessions: false, tokens: false, totp: false })
                  setLockdownError(null)
                }}
                text="Cancel"
              />
            </div>
          </div>
        ) : (
          <div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setConfirmLockdown(true)}
              text="Initiate Lockdown"
            />
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Scrub & Delete */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <H3>Scrub &amp; Delete All Data</H3>
          <Paragraph>
            Permanently deletes all trackers, snapshots, roles, and settings from the database.
            Scrubs all stored API tokens and usernames before deletion. The application will reset
            to first-run setup.
          </Paragraph>
        </div>

        {confirmNuke ? (
          <div className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim">
            <p className="text-sm font-sans text-primary leading-relaxed">
              This will permanently destroy all data. There is no recovery.
            </p>
            <Input
              type="password"
              autoComplete="off"
              data-1p-ignore
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
                onClick={handleNuke}
                text={nukeSubmitting ? "Scrubbing…" : "Delete Everything"}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmNuke(false)
                  setNukePassword("")
                  setNukeError(null)
                }}
                text="Cancel"
              />
            </div>
          </div>
        ) : (
          <div>
            <Button size="sm" variant="danger" onClick={() => setConfirmNuke(true)}>
              Scrub &amp; Delete
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}
