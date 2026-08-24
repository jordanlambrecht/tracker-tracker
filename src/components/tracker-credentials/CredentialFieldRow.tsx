// src/components/tracker-credentials/CredentialFieldRow.tsx
//
// One credential field: its name, its value, and the two buttons that are the
// whole reason this feature exists.
//
// ── THE RULE THIS COMPONENT ENFORCES ─────────────────────────────────────────
// COPY MUST NOT REVEAL. When the user copies a secret they have not shown, the
// plaintext is fetched into a LOCAL CONST, handed to the clipboard, and dropped.
// It never touches component state, so it is never rendered and never lands in
// the React tree. Show and Copy hit the same endpoint but only Show writes what
// it gets back into the draft.

"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { CheckLargeIcon, CopyIcon, EyeIcon, EyeOffIcon, TrashIcon } from "@/components/ui/Icons"
import { Notice } from "@/components/ui/Notice"
import { copyTextToClipboard } from "@/lib/clipboard"
import type { DraftField } from "@/lib/tracker-credentials/draft"

export interface CredentialFieldRowProps {
  field: DraftField
  disabled: boolean
  onChange: (patch: Partial<DraftField>) => void
  onRemove: () => void
  /** Fetches ONE field's plaintext. Rejects with a user-facing message. */
  onReveal: (fieldId: string) => Promise<string>
  /** Pushes a message into the sheet's live region. */
  onAnnounce: (message: string) => void
}

const MASK = "••••••••••••"

export function CredentialFieldRow({
  field,
  disabled,
  onChange,
  onRemove,
  onReveal,
  onAnnounce,
}: CredentialFieldRowProps) {
  const valueId = useId()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** True when the clipboard is unusable here, so the row can offer Show instead. */
  const [offerManualCopy, setOfferManualCopy] = useState(false)
  /**
   * What Reveal handed back, so Hide can tell "the user only looked" from "the
   * user edited". Looking must not mark the form dirty.
   */
  const revealedOriginal = useRef<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const flashCopied = useCallback(() => {
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  const isHeld = field.value !== null
  const label = field.label.trim() || "Unnamed field"
  // Only a field that is stored on the server can be revealed; a brand-new one
  // has no id yet and nothing behind it.
  const canReveal = field.secret && field.id !== null && field.hasStoredValue

  async function handleToggleShow() {
    setError(null)
    if (field.shown) {
      // Reverting an untouched reveal back to "not held" is what keeps looking
      // at a secret from counting as an edit. See isDraftDirty.
      const unchanged =
        revealedOriginal.current !== null && field.value === revealedOriginal.current
      revealedOriginal.current = null
      onChange({ shown: false, value: unchanged ? null : field.value })
      return
    }
    if (isHeld) {
      onChange({ shown: true })
      return
    }
    if (!canReveal || !field.id) {
      // A stored secret with nothing in it. Reveal `shown` ONLY, writing
      // `value: ""` here would look identical on screen but would flip the field
      // from "not held" to "held and empty", which is a real edit and would end
      // in a "discard your changes?" prompt for someone who only clicked Show.
      onChange({ shown: true })
      return
    }
    setBusy(true)
    try {
      const value = await onReveal(field.id)
      revealedOriginal.current = value
      onChange({ shown: true, value })
      setOfferManualCopy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that credential")
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    setError(null)
    setOfferManualCopy(false)

    // A LOCAL CONST, deliberately. Assigning this to state would put the secret
    // in the render tree and turn every copy into a reveal.
    let value = field.value
    if (value === null) {
      if (!field.id) return
      setBusy(true)
      try {
        value = await onReveal(field.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that credential")
        return
      } finally {
        setBusy(false)
      }
    }

    const outcome = await copyTextToClipboard(value)
    if (outcome === "copied") {
      flashCopied()
      onAnnounce(`${label} copied to clipboard`)
      return
    }
    // Silence here would be the worst outcome: the user believes they hold the
    // secret and pastes whatever was on the clipboard before.
    setError(
      "Your browser blocked the clipboard. This usually means the app is served over plain HTTP rather than HTTPS."
    )
    setOfferManualCopy(true)
    onAnnounce(`Could not copy ${label}. The browser blocked clipboard access.`)
  }

  function handleValueChange(next: string) {
    // Emptying a MASKED box reverts to "no change" rather than to "clear".
    // The user cannot see what they are deleting there, so a stray keystroke
    // must not be able to destroy a stored passkey; the explicit Clear button
    // below is the way to actually empty one.
    if (next === "" && !field.shown && field.hasStoredValue) {
      onChange({ value: null })
      return
    }
    onChange({ value: next })
  }

  const showMask = field.secret && !field.shown
  const placeholder = showMask && field.hasStoredValue ? `${MASK} (stored)` : "Not set"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <input
          aria-label="Field name"
          value={field.label}
          disabled={disabled}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field name"
          className="w-40 shrink-0 font-sans text-xs text-secondary bg-control-bg rounded-nm-sm px-3 py-2 nm-inset border-0 focus:outline-none placeholder:text-muted disabled:opacity-40"
        />

        {/* The editable name above doubles as the visible label, so the value
            input gets a programmatic one of its own, and useId ties them together
            without printing the name twice. */}
        <label htmlFor={valueId} className="sr-only">
          {label}
        </label>
        <input
          id={valueId}
          type={showMask ? "password" : "text"}
          value={field.value ?? ""}
          disabled={disabled}
          autoComplete="off"
          data-1p-ignore
          spellCheck={false}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${valueId}-error` : undefined}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 font-mono text-sm text-primary bg-control-bg rounded-nm-sm px-3 py-2 nm-inset border-0 focus:outline-none placeholder:text-muted disabled:opacity-40"
        />

        <Button
          variant="secondary"
          size="icon"
          onClick={handleCopy}
          disabled={disabled || busy || (!isHeld && !canReveal)}
          // Icon-only: the accessible name has to carry which field this is, or
          // a screen reader hears "Copy" five times in a row.
          aria-label={`Copy ${label}`}
          leftIcon={
            copied ? (
              <CheckLargeIcon width="12" height="12" className="text-success" />
            ) : (
              <CopyIcon width="12" height="12" />
            )
          }
        />

        {field.secret && (
          <Button
            variant="secondary"
            size="icon"
            onClick={handleToggleShow}
            disabled={disabled || busy}
            // aria-pressed, not just a label swap: this is a two-state control
            // and assistive tech should be able to read its state directly.
            aria-pressed={field.shown}
            aria-label={field.shown ? `Hide ${label}` : `Show ${label}`}
            leftIcon={
              field.shown ? (
                <EyeOffIcon width="12" height="12" />
              ) : (
                <EyeIcon width="12" height="12" />
              )
            }
          />
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${label}`}
          leftIcon={<TrashIcon width="12" height="12" />}
        />
      </div>

      {field.secret && field.hasStoredValue && field.value === "" && (
        <p className="text-xs font-sans text-warn pl-2">
          This will erase the stored value when you save.
        </p>
      )}

      {field.secret && field.hasStoredValue && field.value !== "" && (
        <Button
          variant="minimal"
          size="sm"
          className="self-start"
          disabled={disabled}
          // Explicit, visible destruction. The masked input deliberately cannot
          // do this by being emptied.
          onClick={() => onChange({ value: "", shown: true })}
          text="Clear stored value"
        />
      )}

      {error && (
        <div id={`${valueId}-error`} className="flex items-center gap-3">
          <Notice variant="warn" message={error} />
          {offerManualCopy && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleShow}
              disabled={disabled || busy}
              text="Show it instead"
            />
          )}
        </div>
      )}
    </div>
  )
}
