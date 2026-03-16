// src/components/settings/AccountSection.tsx
//
// Functions: AccountSection

"use client"

import { H2, H3, Paragraph, Subtext } from "@typography"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { RedactedText } from "@/components/ui/RedactedText"
import { Toggle } from "@/components/ui/Toggle"
import { usePatchSettings } from "@/hooks/usePatchSettings"
import { extractApiError } from "@/lib/client-helpers"

type ScrubState = "idle" | "confirming" | "scrubbing"

export interface AccountSectionProps {
  initialStoreUsernames: boolean
  initialUsername: string
}

export function AccountSection({ initialStoreUsernames, initialUsername }: AccountSectionProps) {
  const router = useRouter()

  // ── Privacy ──────────────────────────────────────────────────────────
  const [storeUsernames, setStoreUsernames] = useState(initialStoreUsernames)
  const [scrubState, setScrubState] = useState<ScrubState>("idle")
  const { saving, error, patch: patchPrivacy } = usePatchSettings()

  async function patchSettings(payload: { storeUsernames: boolean; scrubExisting?: boolean }) {
    const result = await patchPrivacy(payload)
    if (result !== null) {
      setStoreUsernames((result as { storeUsernames: boolean }).storeUsernames)
    }
    setScrubState("idle")
  }

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

  // ── Username ─────────────────────────────────────────────────────────
  const [username, setUsername] = useState(initialUsername)
  const [savedUsername, setSavedUsername] = useState(initialUsername)
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  async function handleSaveUsername() {
    setUsernameError(null)
    const trimmed = username.trim()
    if (trimmed && trimmed.length < 6) {
      setUsernameError("Username must be at least 6 characters")
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
        throw new Error(await extractApiError(res, "Save failed"))
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

  // ── Password ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

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
        throw new Error(await extractApiError(res, "Failed"))
      }
      router.push("/login")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      {/* ── Account ──────────────────────────────────────────────────── */}
      <section aria-labelledby="account-heading">
        <H2 id="account-heading" className="mb-4">
          Account
        </H2>

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
            <Paragraph>Re-encrypts all stored API tokens. You will be logged out.</Paragraph>
            {passwordError && (
              <p className="text-xs font-sans text-danger" role="alert">
                {passwordError}
              </p>
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

      {/* ── Privacy ──────────────────────────────────────────────────── */}
      <section aria-labelledby="privacy-heading">
        <H2 id="privacy-heading" className="mb-4">
          Privacy
        </H2>

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
            <div className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-warn-dim">
              <p className="text-sm font-sans text-primary leading-relaxed">
                Also scrub existing usernames from historical data?
              </p>
              <Paragraph>
                This will permanently replace all stored usernames and user classes with redacted
                markers. This cannot be undone.
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
            This does not provide strong anonymization. Character count and other data points may
            still allow correlation. For full protection, deploy on an encrypted filesystem.
          </Subtext>

          {error && (
            <p className="text-xs font-sans text-danger" role="alert">
              {error}
            </p>
          )}
        </Card>
      </section>
    </>
  )
}
