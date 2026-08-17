// src/components/TrackerCredentialsSheet.tsx
//
// The tracker credential vault, as a side sheet. Sibling of
// TrackerSettingsSheet.tsx and built on the same Sheet primitive.
//
// ── THE THREE THINGS THAT MAKE THIS SHEET DIFFERENT ──────────────────────────
//
// 1. IT EDITS WHAT IT CANNOT SEE. Secret values are never sent to the browser.
//    A field the user has not revealed is held as `value: null`, which
//    serializes to an OMITTED `value`, which the server reads as "keep what is
//    stored". Without that, renaming a section would blank every secret in the
//    vault behind a successful-looking save.
//
// 2. IT OPENS EVEN WHEN THE FEATURE IS OFF. A 403 from the API is not an error
//    state here, it is the opt-in gate — the sheet explains the feature and
//    links straight at the Settings toggle that turns it on. Hiding the feature
//    with no route to enabling it is the failure mode this avoids.
//
// 3. COPY DOES NOT REVEAL. See CredentialFieldRow.
//
// ── REGISTRY DEFAULTS ────────────────────────────────────────────────────────
// They seed a NEW vault and nothing else. Once a vault exists, the user's
// sections and fields are the entire truth and the registry is never consulted
// again — see the long note on draftFromView() for why re-merging later would
// mean the app arguing with the user about their own data.

"use client"

import clsx from "clsx"
import Link from "next/link"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { CREDENTIAL_VAULT_SETTINGS_HREF } from "@/components/settings/CredentialVaultSection"
import { CredentialFieldRow } from "@/components/tracker-credentials/CredentialFieldRow"
import { Button, buttonVariants, ConfirmAction, Notice, Sheet } from "@/components/ui"
import {
  ChevronDownSmallIcon,
  ChevronUpSmallIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { getDefaultCredentialFields } from "@/data/tracker-credential-defaults"
import { findRegistryEntry } from "@/data/tracker-registry"
import {
  type DraftField,
  type DraftVault,
  draftFromView,
  draftToInput,
  draftToValidationVault,
  isDraftDirty,
  newDraftField,
  newDraftSection,
} from "@/lib/tracker-credentials/draft"
import { validateTrackerCredentialVault } from "@/lib/tracker-credentials/validate"
import type { TrackerCredentialVaultView } from "@/lib/tracker-credentials/view"

type SheetStatus = "loading" | "gated" | "ready" | "error"

export interface TrackerCredentialsSheetProps {
  open: boolean
  trackerId: number
  trackerName: string
  /** Used only to pick the registry defaults that seed a brand-new vault. */
  trackerBaseUrl: string
  onClose: () => void
}

export function TrackerCredentialsSheet({
  open,
  trackerId,
  trackerName,
  trackerBaseUrl,
  onClose,
}: TrackerCredentialsSheetProps) {
  const [status, setStatus] = useState<SheetStatus>("loading")
  const [draft, setDraft] = useState<DraftVault>({ sections: [] })
  const [original, setOriginal] = useState<DraftVault>({ sections: [] })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  const headingId = useId()
  const bodyRef = useRef<HTMLDivElement | null>(null)
  /** Whatever had focus before the sheet opened, so it can be handed back. */
  const returnFocusRef = useRef<HTMLElement | null>(null)
  /** Latch so the open-focus happens once per open, not once per status change. */
  const hasFocusedRef = useRef(false)

  const dirty = isDraftDirty(draft, original)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setStatus("loading")
    setLoadError(null)
    setSaveError(null)
    try {
      const res = await fetch(`/api/trackers/${trackerId}/credentials`)

      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { credentialVaultDisabled?: boolean }
        // A FIELD, not a message match: the gate is a first-class state and the
        // wording of the error is free to change.
        if (body.credentialVaultDisabled) {
          setStatus("gated")
          return
        }
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setLoadError(body.error ?? "Could not load credentials")
        setStatus("error")
        return
      }

      const body = (await res.json()) as { vault: TrackerCredentialVaultView | null }
      // draftFromView consults these ONLY when `vault` is null. An unrecognised
      // baseUrl falls to `custom`, which getDefaultCredentialFields deliberately
      // leaves out of its platform map so it lands on the universal fallback.
      const registryEntry = findRegistryEntry(trackerBaseUrl)
      const seeded = draftFromView(
        body.vault,
        getDefaultCredentialFields(registryEntry ?? { platform: "custom" })
      )
      setDraft(seeded)
      // A seeded-from-defaults vault is NOT a pending change: opening the sheet
      // and closing it again must neither prompt to discard nor write anything.
      setOriginal(seeded)
      setStatus("ready")
    } catch {
      setLoadError("Network error — could not load credentials")
      setStatus("error")
    }
  }, [trackerId, trackerBaseUrl])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  // ── Focus management ───────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      return
    }
    // Closing: hand focus back to whatever opened the sheet, so the user is not
    // dropped at the top of the document.
    returnFocusRef.current?.focus?.()
    returnFocusRef.current = null
    hasFocusedRef.current = false
  }, [open])

  useEffect(() => {
    // Focus once the body actually has content — focusing the container while it
    // still says "Loading" moves the user somewhere that is about to be replaced.
    //
    // ONCE PER OPEN, and the latch is what makes that true. Saving re-runs load(),
    // which cycles status ready → loading → ready; without the latch, every save
    // would yank focus out of whatever input the user was in and drop it on the
    // container.
    if (open && status !== "loading" && !hasFocusedRef.current) {
      hasFocusedRef.current = true
      bodyRef.current?.focus()
    }
  }, [open, status])

  // ── Close, with the unsaved-changes interception ────────────────────────────

  // Backdrop click, the X button and Escape ALL funnel through Sheet's onClose,
  // so intercepting here covers every route out of the sheet.
  const handleClose = useCallback(() => {
    if (saving) return
    if (dirty) {
      setConfirmingDiscard(true)
      return
    }
    onClose()
  }, [dirty, saving, onClose])

  const discardAndClose = useCallback(() => {
    setConfirmingDiscard(false)
    onClose()
  }, [onClose])

  // ── Reveal ─────────────────────────────────────────────────────────────────

  const revealField = useCallback(
    async (fieldId: string): Promise<string> => {
      const res = await fetch(`/api/trackers/${trackerId}/credentials/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        // Surfaces the 429 from the reveal limiter verbatim — "Too many reveals"
        // is actionable, "something went wrong" is not.
        throw new Error(body.error ?? "Could not read that credential")
      }
      const body = (await res.json()) as { value: string }
      return body.value
    },
    [trackerId]
  )

  // ── Draft mutation ─────────────────────────────────────────────────────────

  const patchField = useCallback(
    (sectionKey: string, fieldKey: string, patch: Partial<DraftField>) => {
      setDraft((prev) => ({
        sections: prev.sections.map((section) =>
          section.key !== sectionKey
            ? section
            : {
                ...section,
                fields: section.fields.map((field) =>
                  field.key === fieldKey ? { ...field, ...patch } : field
                ),
              }
        ),
      }))
    },
    []
  )

  const removeField = useCallback((sectionKey: string, fieldKey: string) => {
    setDraft((prev) => ({
      sections: prev.sections.map((section) =>
        section.key !== sectionKey
          ? section
          : { ...section, fields: section.fields.filter((f) => f.key !== fieldKey) }
      ),
    }))
  }, [])

  const addField = useCallback((sectionKey: string) => {
    setDraft((prev) => ({
      sections: prev.sections.map((section) =>
        section.key !== sectionKey
          ? section
          : { ...section, fields: [...section.fields, newDraftField()] }
      ),
    }))
  }, [])

  const renameSection = useCallback((sectionKey: string, title: string) => {
    setDraft((prev) => ({
      sections: prev.sections.map((s) => (s.key === sectionKey ? { ...s, title } : s)),
    }))
  }, [])

  const removeSection = useCallback((sectionKey: string) => {
    setDraft((prev) => ({ sections: prev.sections.filter((s) => s.key !== sectionKey) }))
  }, [])

  const addSection = useCallback(() => {
    setDraft((prev) => ({ sections: [...prev.sections, newDraftSection()] }))
  }, [])

  /** ARRAY ORDER IS DISPLAY ORDER, so reordering really is just a splice. */
  const moveSection = useCallback((index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.sections.length) return prev
      const sections = [...prev.sections]
      const [moved] = sections.splice(index, 1)
      sections.splice(target, 0, moved)
      return { sections }
    })
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    // Inline validation first, using the same pure validator the route runs.
    // Values the client does not hold stand in as "", so the size limits are an
    // under-estimate here and the server's check on the MERGED vault stays
    // authoritative — but a blank label or a duplicate id is caught with no
    // round trip.
    const invalid = validateTrackerCredentialVault(draftToValidationVault(draft))
    if (invalid) {
      setSaveError(invalid)
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/trackers/${trackerId}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vault: draftToInput(draft) }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setSaveError(body.error ?? "Could not save credentials")
        return
      }
      setAnnouncement("Credentials saved")
      // The draft is clean now, so the reason the prompt was up is gone. Leaving
      // it would ask the user to discard changes that have just been persisted.
      setConfirmingDiscard(false)
      // Reload rather than trusting the local draft: the server assigns ids to
      // new fields and recomputes hasValue, and the sheet must mirror what is
      // actually stored before the user reveals anything against it.
      await load()
    } catch {
      setSaveError("Network error — credentials were not saved")
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const footer =
    status === "ready" ? (
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-sans text-muted">
          {dirty ? "Unsaved changes" : "No changes"}
        </span>
        <div className="flex gap-3">
          {/* "Cancel", not "Close": Sheet's own backdrop already carries the
              accessible name "Close", and two controls with the same name in one
              dialog is ambiguous to anyone navigating by name. */}
          <Button variant="ghost" onClick={handleClose} disabled={saving} text="Cancel" />
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            loading={saving}
            text={saving ? "Saving..." : "Save"}
          />
        </div>
      </div>
    ) : null

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={`Credentials — ${trackerName}`}
      busy={saving}
      footer={footer}
    >
      {/* tabIndex={-1} is the sheet's initial focus target: focus is sent here on
          open so Escape and Tab start from inside the dialog rather than at the
          top of the document. -1 keeps it out of the tab ORDER while still being
          programmatically focusable. */}
      <div ref={bodyRef} tabIndex={-1} className="flex flex-col gap-5 p-6 pb-8 focus:outline-none">
        {/* Live region, mounted EMPTY so a later update is actually announced —
            a region that appears already containing its text is often missed.
            Carries a testid because Notice also renders role="status" for its
            warn variant, so the role alone is not a unique handle. */}
        <p
          data-testid="credential-announcer"
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {announcement}
        </p>

        {status === "loading" && (
          <p className="text-sm font-sans text-secondary">Loading credentials…</p>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <Notice variant="danger" box message={loadError ?? "Could not load credentials"} />
            <Button variant="secondary" size="sm" onClick={load} text="Try again" className="self-start" />
          </div>
        )}

        {/* The opt-in gate. The sheet still OPENS and still explains itself — the
            owner's requirement is a route to enabling the feature, not a hidden
            feature. */}
        {status === "gated" && (
          <div className="flex flex-col gap-4">
            <h3 id={headingId} className="text-sm font-sans font-semibold text-primary">
              Credential storage is turned off
            </h3>
            <p className="text-sm font-sans text-secondary leading-relaxed">
              Private trackers hand out a pile of per-user secrets — API keys, RSS passkeys, IRC
              logins, announce URLs. Turn this on to keep {trackerName}&apos;s in one place,
              encrypted with your master password and shown only when you ask.
            </p>
            <Notice
              variant="info"
              message="Values are encrypted at rest, re-encrypted when you change your password, and never sent to the browser until you reveal them."
            />
            {/* A real link, not a button with a router push: the target is a
                different page and users expect to be able to middle-click it.
                The href is IMPORTED from the settings section that owns the
                anchor, so renaming that section cannot silently rot this link
                into a no-op scroll. */}
            <Link
              href={CREDENTIAL_VAULT_SETTINGS_HREF}
              className={clsx(buttonVariants({ variant: "primary", size: "sm" }), "self-start")}
            >
              Enable in Settings
            </Link>
          </div>
        )}

        {status === "ready" && (
          <>
            {confirmingDiscard && (
              <ConfirmAction
                colorScheme="warn"
                message="You have unsaved credential changes."
                confirmLabel="Discard and close"
                onConfirm={discardAndClose}
                onCancel={() => setConfirmingDiscard(false)}
                additionalActions={
                  <Button size="sm" variant="primary" onClick={handleSave} text="Save and keep editing" />
                }
              />
            )}

            {draft.sections.length === 0 && (
              <p className="text-sm font-sans text-secondary">
                No sections yet. Add one to start storing credentials for {trackerName}.
              </p>
            )}

            {draft.sections.map((section, index) => (
              <section
                key={section.key}
                className="flex flex-col gap-3 nm-inset-sm rounded-nm-md p-4"
                aria-label={section.title.trim() || "Untitled section"}
              >
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Section title"
                    value={section.title}
                    disabled={saving}
                    onChange={(e) => renameSection(section.key, e.target.value)}
                    placeholder="Section title"
                    className="flex-1 min-w-0 font-sans text-sm font-semibold text-primary bg-transparent border-0 focus:outline-none placeholder:text-muted"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSection(index, -1)}
                    disabled={saving || index === 0}
                    aria-label={`Move ${section.title.trim() || "section"} up`}
                    leftIcon={<ChevronUpSmallIcon width="12" height="12" />}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSection(index, 1)}
                    disabled={saving || index === draft.sections.length - 1}
                    aria-label={`Move ${section.title.trim() || "section"} down`}
                    leftIcon={<ChevronDownSmallIcon width="12" height="12" />}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSection(section.key)}
                    disabled={saving}
                    aria-label={`Delete ${section.title.trim() || "section"}`}
                    leftIcon={<TrashIcon width="12" height="12" />}
                  />
                </div>

                {section.fields.map((field) => (
                  <CredentialFieldRow
                    key={field.key}
                    field={field}
                    disabled={saving}
                    onChange={(patch) => patchField(section.key, field.key, patch)}
                    onRemove={() => removeField(section.key, field.key)}
                    onReveal={revealField}
                    onAnnounce={setAnnouncement}
                  />
                ))}

                <Button
                  variant="minimal"
                  size="sm"
                  className="self-start"
                  onClick={() => addField(section.key)}
                  disabled={saving}
                  leftIcon={<PlusIcon width="12" height="12" />}
                  text="Add field"
                />
              </section>
            ))}

            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={addSection}
              disabled={saving}
              leftIcon={<PlusIcon width="12" height="12" />}
              text="Add section"
            />

            <Notice variant="danger" message={saveError} />
          </>
        )}
      </div>
    </Sheet>
  )
}
