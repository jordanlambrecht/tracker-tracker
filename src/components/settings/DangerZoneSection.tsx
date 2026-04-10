// src/components/settings/DangerZoneSection.tsx
"use client"

import { H3, Paragraph } from "@typography"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button, Checkbox, ConfirmAction, Input, Notice } from "@/components/ui"
import { useDestructiveAction } from "@/hooks/useDestructiveAction"

export function DangerZoneSection() {
  const router = useRouter()

  const [resetStatsSuccess, setResetStatsSuccess] = useState(false)

  const resetStats = useDestructiveAction("/api/settings/reset-stats", () => {
    setResetStatsSuccess(true)
  })

  const lockdown = useDestructiveAction("/api/settings/lockdown", () => {
    router.push("/login")
  })
  const [lockdownChecks, setLockdownChecks] = useState({
    sessions: false,
    tokens: false,
    totp: false,
  })

  const nuke = useDestructiveAction("/api/settings/nuke", () => {
    router.push("/setup")
  })

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

        {resetStats.confirming ? (
          <ConfirmAction
            message="This will permanently delete all snapshot history for every tracker and download client. This cannot be undone."
            confirmLabel="Confirm Reset"
            confirmingLabel="Resetting…"
            onConfirm={resetStats.execute}
            onCancel={resetStats.cancel}
            confirming={resetStats.submitting}
            confirmDisabled={!resetStats.password.trim()}
          >
            <Input
              type="password"
              autoComplete="off"
              data-1p-ignore
              label="Master Password"
              value={resetStats.password}
              onChange={(e) => resetStats.setPassword(e.target.value)}
              placeholder="Enter your master password to confirm"
              disabled={resetStats.submitting}
              error={resetStats.error ?? undefined}
            />
          </ConfirmAction>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                resetStats.open()
                setResetStatsSuccess(false)
              }}
              text="Reset All Stats"
            />
            {resetStatsSuccess && <Notice variant="success" message="All stats have been reset." />}
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

        {lockdown.confirming ? (
          <ConfirmAction
            message="Confirm you understand the consequences:"
            confirmLabel="Confirm Lockdown"
            confirmingLabel="Locking down…"
            onConfirm={lockdown.execute}
            onCancel={() => {
              lockdown.cancel()
              setLockdownChecks({ sessions: false, tokens: false, totp: false })
            }}
            confirming={lockdown.submitting}
            confirmDisabled={
              !lockdownChecks.sessions ||
              !lockdownChecks.tokens ||
              !lockdownChecks.totp ||
              !lockdown.password.trim()
            }
          >
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
              value={lockdown.password}
              onChange={(e) => lockdown.setPassword(e.target.value)}
              placeholder="Enter your master password to confirm"
              disabled={lockdown.submitting}
              error={lockdown.error ?? undefined}
            />
          </ConfirmAction>
        ) : (
          <div>
            <Button size="sm" variant="danger" onClick={lockdown.open} text="Initiate Lockdown" />
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

        {nuke.confirming ? (
          <ConfirmAction
            message="This will permanently destroy all data. There is no recovery."
            confirmLabel="Delete Everything"
            confirmingLabel="Scrubbing…"
            onConfirm={nuke.execute}
            onCancel={nuke.cancel}
            confirming={nuke.submitting}
            confirmDisabled={!nuke.password.trim()}
          >
            <Input
              type="password"
              autoComplete="off"
              data-1p-ignore
              label="Master Password"
              value={nuke.password}
              onChange={(e) => nuke.setPassword(e.target.value)}
              placeholder="Enter your master password to confirm"
              disabled={nuke.submitting}
              error={nuke.error ?? undefined}
            />
          </ConfirmAction>
        ) : (
          <div>
            <Button size="sm" variant="danger" onClick={nuke.open}>
              Scrub &amp; Delete
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}
