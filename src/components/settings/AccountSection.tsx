// src/components/settings/AccountSection.tsx
//
// Functions: AccountSection

"use client"

import { H3, Paragraph } from "@typography"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { extractApiError } from "@/lib/client-helpers"

export interface AccountSectionProps {
  initialUsername: string
}

export function AccountSection({ initialUsername }: AccountSectionProps) {
  const router = useRouter()

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
    <SettingsSection id="account" title="Account" cardClassName="flex flex-col gap-6">
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
        <Paragraph>Used to log in alongside your master password. Leave empty to remove.</Paragraph>
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
    </SettingsSection>
  )
}
