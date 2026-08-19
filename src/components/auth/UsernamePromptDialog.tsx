// src/components/auth/UsernamePromptDialog.tsx
//
// Asks for a login username after a full sign-in, for installs whose
// app_settings.username is NULL (accounts created before setup required one).
//
// Why here and not on the login form: a username set before authentication is a
// username an anonymous caller can set. The layout that mounts this component
// has already redirected anyone without a session, and getSession() rejects any
// token carrying a `purpose` claim. So a login that is still waiting on its
// TOTP code holds a pending token, has no session, and never reaches this
// prompt. The password leg alone cannot summon it.
//
// Why a dialog rather than a /welcome page: a dedicated page would have to live
// inside the (auth) group to be session-protected, and the group's layout would
// then need an exemption for its own path or the redirect gate recurses. A modal
// over whatever page the user asked for also preserves deep links.

"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { Subtext } from "@/components/ui/Typography"
import { USERNAME_MAX, USERNAME_MIN, validateUsername } from "@/lib/limits"

/**
 * sessionStorage flag meaning "the user picked Skip for now during THIS browser
 * session".
 *
 * "Skip for now" is taken literally: ask again at the next sign-in, not at the
 * next page load. A bare `username IS NULL` check would re-nag on every
 * navigation, because the (auth) layout is force-dynamic and re-evaluates each
 * time. sessionStorage is the smallest thing that expires on exactly the right
 * boundary. It dies with the browser session, and LoginForm clears it on every
 * sign-in attempt so a fresh login re-arms the prompt.
 *
 * It carries no security weight whatsoever. It suppresses a nag; the write is
 * authorised server-side by authenticate() in POST /api/auth/username, full
 * stop. A user who clears it just sees the prompt again.
 */
export const USERNAME_PROMPT_SKIP_KEY = "tt-username-prompt-skipped"

/** sessionStorage throws in some privacy modes. A nag suppressor is not worth a crash. */
function suppressPrompt(): void {
  try {
    sessionStorage.setItem(USERNAME_PROMPT_SKIP_KEY, "1")
  } catch {
    // Storage unavailable. The prompt simply reappears on the next navigation.
  }
}

function isSuppressed(): boolean {
  try {
    return sessionStorage.getItem(USERNAME_PROMPT_SKIP_KEY) === "1"
  } catch {
    return false
  }
}

interface UsernamePromptDialogProps {
  /** Called once the username has been persisted. */
  onSaved: () => void
  /** Called when the user defers. Suppression is the caller's job. */
  onSkipped: () => void
}

function UsernamePromptDialog({ onSaved, onSkipped }: UsernamePromptDialogProps) {
  const [username, setUsername] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    // The same validator the server runs, so the common mistakes are named
    // before a round-trip. The server still re-validates. This is convenience,
    // not enforcement.
    const check = validateUsername(username)
    if (!check.ok) {
      setError(check.error)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: check.username }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error || "Could not save your username. Try again.")
        return
      }
      onSaved()
    } catch {
      setError("Network error — could not save your username.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      // Escape and backdrop clicks are not answers to this question. "Skip for
      // now" is the explicit way out, so the accidental ones are closed off.
      onClose={() => {}}
      busy
      onSubmit={save}
      title="Set a login username"
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <Subtext>
          This account signs in with a password only. Adding a username gives the login form a
          second field to match.
        </Subtext>

        <Input
          label="Username"
          autoComplete="username"
          placeholder={`${USERNAME_MIN}–${USERNAME_MAX} characters`}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setError(null)
          }}
          disabled={saving}
        />

        <Subtext>
          Letters, numbers, underscores, hyphens, dots and spaces. Once set, this username is
          <strong> required at your next sign-in</strong> — capitalisation is not, since the login
          check is case-insensitive.
        </Subtext>

        <Notice message={error ?? undefined} />

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="minimal"
            size="sm"
            onClick={onSkipped}
            disabled={saving}
            text="Skip for now"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            text={saving ? "Saving…" : "Save username"}
          />
        </div>

        <Subtext>Skipping asks again at your next sign-in. You can also set it in Settings.</Subtext>
      </div>
    </Dialog>
  )
}

/**
 * Container. `needed` is read server-side from app_settings.username by the
 * (auth) layout, so there is no extra round-trip and no client fetch that could
 * fail open.
 *
 * The open state is decided in an effect rather than during render because it
 * depends on sessionStorage, which does not exist during SSR. Deciding it
 * inline would hydrate a mismatch.
 */
function UsernamePrompt({ needed }: { needed: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(needed && !isSuppressed())
  }, [needed])

  if (!open) return null

  return (
    <UsernamePromptDialog
      onSaved={() => {
        setOpen(false)
        // Server components (i.e. the settings Account form) rendered the old
        // NULL. Without this they keep showing an empty username over a stored
        // one until the next full load.
        router.refresh()
      }}
      onSkipped={() => {
        suppressPrompt()
        setOpen(false)
      }}
    />
  )
}

// UsernamePromptDialog stays private. UsernamePrompt is its only consumer, and
// knip cannot flag an export used solely inside its own file (knip.json sets
// ignoreExportsUsedInFile), so a public one would never be caught.
export { UsernamePrompt }
