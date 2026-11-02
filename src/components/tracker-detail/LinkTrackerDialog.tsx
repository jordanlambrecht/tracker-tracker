// src/components/tracker-detail/LinkTrackerDialog.tsx
"use client"

import { H2, Subtext } from "@typography"
import clsx from "clsx"
import { useCallback, useState } from "react"
import { CredentialFields } from "@/components/CredentialFields"
import { ADDABLE_TRACKERS, TrackerCombobox } from "@/components/TrackerCombobox"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Notice } from "@/components/ui/Notice"
import {
  buildCredentialBlob,
  type CredentialValues,
  credentialFormFor,
  EMPTY_CREDENTIAL_VALUES,
  validateCredentialValues,
} from "@/lib/credential-forms"
import type { TrackerSummary } from "@/types/api"

interface LinkTrackerDialogProps {
  open: boolean
  onClose: () => void
  trackerId: number
  /** The row's own setting, so the key test takes the route its polls will. */
  useProxy: boolean
  /** From useHeldTrackerSlugs, so a tracker already in use can't be picked. */
  heldSlugs: ReadonlyMap<string, boolean>
  /** Receives the link route's response, the row as now linked. */
  onLinked: (updated: TrackerSummary) => void
}

/**
 * Links an unlinked row to a tracker in the list. The key is typed again for the
 * tracker picked and tested there first, the way Add Tracker does, so the key
 * saved for the old address is never sent to the new one.
 */
function LinkTrackerDialog({
  open,
  onClose,
  trackerId,
  useProxy,
  heldSlugs,
  onLinked,
}: LinkTrackerDialogProps) {
  const [slug, setSlug] = useState("")
  const [credentials, setCredentials] = useState<CredentialValues>(EMPTY_CREDENTIAL_VALUES)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ username: string; group: string | null } | null>(
    null
  )

  const setCredentialField = useCallback((field: keyof CredentialValues, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
  }, [])

  const resetForm = useCallback(() => {
    setSlug("")
    setCredentials(EMPTY_CREDENTIAL_VALUES)
    setErrors({})
    setLoading(false)
    setTestResult(null)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  function handlePick(next: string) {
    setSlug(next)
    // A key typed for one tracker is never sent to the next one picked.
    setCredentials(EMPTY_CREDENTIAL_VALUES)
    setErrors({})
    setTestResult(null)
  }

  const entry = ADDABLE_TRACKERS.find((t) => t.slug === slug)
  const credentialForm = entry ? credentialFormFor(entry) : null

  async function handleSubmit() {
    if (!entry || !credentialForm) {
      setErrors({ preset: "Select a tracker" })
      return
    }
    const credentialError = validateCredentialValues(credentialForm, credentials)
    if (credentialError) {
      setErrors({ apiToken: credentialError })
      return
    }

    setErrors({})
    setLoading(true)
    setTestResult(null)
    // navigator is a browser-only global, so it is read in the handler.
    const apiToken = buildCredentialBlob(credentialForm, credentials, navigator.userAgent)

    try {
      const testRes = await fetch("/api/trackers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: entry.slug, apiToken, useProxy }),
      })
      const testData = await testRes.json()
      if (!testRes.ok) {
        setErrors({ apiToken: testData.error ?? "Connection failed" })
        return
      }
      setTestResult({ username: testData.username, group: testData.group })

      const linkRes = await fetch(`/api/trackers/${trackerId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: entry.slug, apiToken }),
      })
      const linkData = await linkRes.json()
      if (!linkRes.ok) {
        setErrors({ form: linkData.error ?? "Failed to link tracker" })
        return
      }

      const linked = linkData as TrackerSummary
      // Fire-and-forget first poll, as Add Tracker does, unless the user paused it
      if (!linked.userPausedAt) {
        fetch(`/api/trackers/${trackerId}/poll`, { method: "POST" }).catch(() => {})
      }

      resetForm()
      onLinked(linked)
    } catch {
      setErrors({ form: "Network error. Please try again" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      formProps={
        { autoComplete: "off", "data-1p-ignore": true } as React.HTMLAttributes<HTMLFormElement>
      }
      title="Link to a Tracker"
      maxWidth="max-w-lg"
      busy={loading}
      footer={
        <div className="flex gap-3">
          <Button type="submit" disabled={loading} text={loading ? "Linking..." : "Link"} />
          <Button variant="ghost" onClick={handleClose} text="Cancel" />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Subtext>
          Pick the tracker this one belongs to and enter your API key for it. The key is tested
          there before anything is saved. History and settings stay.
        </Subtext>

        <div className="flex flex-col gap-1">
          <H2 className="uppercase tracking-wider">Tracker</H2>
          <TrackerCombobox
            presets={ADDABLE_TRACKERS}
            held={heldSlugs}
            value={slug}
            onChange={handlePick}
          />
          <Notice message={errors.preset} />
        </div>

        {/* As tall as the picker's list, which drops over this area before a pick. */}
        <div
          className={clsx(
            "flex flex-col min-h-60",
            credentialForm?.kind === "cookies-username" ||
              credentialForm?.kind === "token-username" ||
              credentialForm?.kind === "login"
              ? "gap-3"
              : "gap-1"
          )}
        >
          {entry && credentialForm && (
            <CredentialFields
              form={credentialForm}
              values={credentials}
              onChange={setCredentialField}
              error={errors.apiToken}
              surface="dialog"
              trackerName={entry.name}
            />
          )}
          {testResult && (
            <Notice variant="success">
              Connected as <span className="font-semibold">{testResult.username}</span>
              {testResult.group ? ` (${testResult.group})` : ""}
            </Notice>
          )}
        </div>

        <Notice message={errors.form} />
      </div>
    </Dialog>
  )
}

export { LinkTrackerDialog }
