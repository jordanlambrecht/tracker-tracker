// src/components/TrackerSettingsSheet.tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import { H2 } from "@typography"
import clsx from "clsx"
import { useRouter } from "next/navigation"
import { type SyntheticEvent, useCallback, useEffect, useState } from "react"
import { CredentialFields } from "@/components/CredentialFields"
import {
  Button,
  ConfirmRemove,
  InfoTip,
  Input,
  MaskedSecret,
  Notice,
  QbtTagWarning,
  Sheet,
  Toggle,
} from "@/components/ui"
import { ColorPicker } from "@/components/ui/ColorPicker"

import { registryEntryFor } from "@/data/tracker-registry"
import {
  buildCredentialBlob,
  type CredentialValues,
  credentialFormForPlatform,
  EMPTY_CREDENTIAL_VALUES,
  validateCredentialValues,
} from "@/lib/credential-forms"
import { localDateStr } from "@/lib/formatters"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

interface TrackerSettingsSheetProps {
  open: boolean
  tracker: TrackerSummary
  onClose: () => void
  /**
   * Receives the tracker exactly as the PATCH response returned it. The sheet
   * already holds the post-write row. Consumers must not re-GET it. That extra
   * round trip adds latency to save/archive.
   */
  onUpdated: (updated: TrackerSummary) => void
}

interface FormState {
  name: string
  color: string
  qbtTag: string
  joinedAt: string
  lastAccessAt: string
  useProxy: boolean
  countCrossSeedUnsatisfied: boolean
  hideUnreadBadges: boolean
  mouseholeUrl: string
}

function formStateFromTracker(t: TrackerSummary): FormState {
  return {
    name: t.name,
    color: t.color,
    qbtTag: t.qbtTag ?? "",
    joinedAt: t.joinedAt ?? "",
    lastAccessAt: t.lastAccessAt ?? "",
    useProxy: t.useProxy ?? false,
    countCrossSeedUnsatisfied: t.countCrossSeedUnsatisfied ?? false,
    hideUnreadBadges: t.hideUnreadBadges ?? false,
    mouseholeUrl: t.mouseholeUrl ?? "",
  }
}

function TrackerSettingsSheet({ open, tracker, onClose, onUpdated }: TrackerSettingsSheetProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Every write mutates a row in the shared ["trackers"] cache. It survives
  // `router.push("/")` and only refetches on the poll interval, so without
  // write-through and invalidate an archived tracker keeps rendering as active.
  const syncTrackerCache = useCallback(
    (next: TrackerSummary | null) => {
      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) => {
        if (!prev) return prev
        if (!next) return prev.filter((t) => t.id !== tracker.id)
        return prev.map((t) => (t.id === next.id ? next : t))
      })
      // Not awaited: the refetch is a background confirmation of the row just
      // written. Awaiting adds a round trip before closing the sheet or
      // navigating.
      queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
    },
    [queryClient, tracker.id]
  )

  const [form, setForm] = useState<FormState>(() => formStateFromTracker(tracker))
  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    setForm(formStateFromTracker(tracker))
  }, [tracker])

  const registryEntry = registryEntryFor(tracker)
  const hasLoginPolicy = !!registryEntry?.rules?.loginIntervalDays

  const [proxyAvailable, setProxyAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open || proxyAvailable !== null) return
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setProxyAvailable(data ? !!data.proxyEnabled : false)
      })
      .catch(() => setProxyAvailable(false))
  }, [open, proxyAvailable])

  const [changingKey, setChangingKey] = useState(false)
  const [credentials, setCredentials] = useState<CredentialValues>(EMPTY_CREDENTIAL_VALUES)
  const credentialForm = credentialFormForPlatform(tracker.platformType)

  const setCredentialField = useCallback((field: keyof CredentialValues, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
  }, [])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const resetTransientState = useCallback(() => {
    setChangingKey(false)
    setCredentials(EMPTY_CREDENTIAL_VALUES)
    setErrors({})
    setSaving(false)
    setDeleting(false)
  }, [])

  function handleClose() {
    resetTransientState()
    onClose()
  }

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault()

    const validationErrors: Record<string, string> = {}
    if (!form.name.trim()) validationErrors.name = "Name is required"
    // AvistaZ is deliberately absent here, see the submit-time check below.
    if (changingKey && credentialForm.kind !== "cookies-username") {
      const credentialError = validateCredentialValues(credentialForm, credentials)
      if (credentialError) validationErrors.apiToken = credentialError
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSaving(true)

    let trimmedToken = ""

    if (changingKey) {
      // AvistaZ credentials are checked after the name check above, so a
      // submit with an empty name reports the name first.
      if (credentialForm.kind === "cookies-username") {
        const credentialError = validateCredentialValues(credentialForm, credentials)
        if (credentialError) {
          setErrors({ apiToken: credentialError })
          setSaving(false)
          return
        }
      }
      trimmedToken = buildCredentialBlob(credentialForm, credentials, navigator.userAgent)
    }

    // Test the new API key before saving
    if (changingKey && trimmedToken) {
      try {
        const testRes = await fetch("/api/trackers/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // A row that names a registry entry is tested by slug, and the route
          // takes the address and platform from the entry. A pre-registry row
          // has nothing but what it stores.
          body: JSON.stringify(
            tracker.registrySlug
              ? { slug: tracker.registrySlug, apiToken: trimmedToken }
              : {
                  baseUrl: tracker.baseUrl,
                  apiToken: trimmedToken,
                  platformType: tracker.platformType,
                }
          ),
        })
        if (!testRes.ok) {
          const testData = await testRes.json().catch(() => ({ error: "Connection failed" }))
          setErrors({ apiToken: (testData as { error?: string }).error ?? "Connection failed" })
          setSaving(false)
          return
        }
      } catch {
        setErrors({ apiToken: "Could not verify API key. Check your connection" })
        setSaving(false)
        return
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      color: form.color,
      qbtTag: form.qbtTag.trim(),
      joinedAt: form.joinedAt || null,
      lastAccessAt: form.lastAccessAt || null,
      useProxy: form.useProxy,
      countCrossSeedUnsatisfied: form.countCrossSeedUnsatisfied,
      hideUnreadBadges: form.hideUnreadBadges,
      mouseholeUrl: form.mouseholeUrl.trim() || null,
    }

    if (changingKey && trimmedToken) {
      payload.apiToken = trimmedToken
    }

    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        setErrors({ form: (data as { error?: string }).error ?? "Save failed" })
        setSaving(false)
        return
      }

      // PATCH /api/trackers/[id] returns the freshly-read row. This is the
      // post-write truth. No follow-up GET needed.
      const updated = (await res.json()) as TrackerSummary
      syncTrackerCache(updated)

      resetTransientState()
      onUpdated(updated)
      onClose()
    } catch {
      setErrors({ form: "Network error. Please try again" })
      setSaving(false)
    }
  }

  async function handleArchive() {
    setSaving(true)
    setErrors({})
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tracker.isActive }),
      })

      // A failed archive must say so, or the click looks like nothing happened.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrors({
          form: (data as { error?: string }).error ?? "Failed to update archive status",
        })
        return
      }

      const updated = (await res.json()) as TrackerSummary
      syncTrackerCache(updated)
      onUpdated(updated)
      onClose()
    } catch {
      setErrors({ form: "Failed to update archive status" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        // Same shared cache as archive. Without this, the deleted row renders
        // in the sidebar after router.push("/").
        syncTrackerCache(null)
        onClose()
        router.push("/")
      } else {
        setErrors({ form: "Failed to delete tracker" })
        setDeleting(false)
      }
    } catch {
      setErrors({ form: "Network error during delete" })
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Tracker Settings" busy={saving || deleting}>
      <div className="flex flex-col p-6 pb-8 gap-5">
        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Nickname"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Display name for this tracker"
            error={errors.name}
          />

          {/* Credentials. Show the masked status or the change input. */}
          <div className="flex flex-col gap-1">
            <H2 className="uppercase tracking-wider">Credentials</H2>
            {changingKey ? (
              <div className="flex flex-col gap-2">
                <CredentialFields
                  form={credentialForm}
                  values={credentials}
                  onChange={setCredentialField}
                  error={errors.apiToken}
                  surface="sheet"
                />
                <Button
                  variant="minimal"
                  size="sm"
                  text="Cancel"
                  className="self-start"
                  onClick={() => {
                    setChangingKey(false)
                    setCredentials(EMPTY_CREDENTIAL_VALUES)
                    setErrors({})
                  }}
                />
              </div>
            ) : (
              <MaskedSecret onChangeClick={() => setChangingKey(true)} />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="qBittorrent Tag"
              value={form.qbtTag}
              onChange={(e) => updateField("qbtTag", e.target.value)}
              placeholder="i.e, aither"
            />
            <QbtTagWarning tag={form.qbtTag} />
          </div>

          {tracker.platformType === "mam" && (
            <div className="flex items-center gap-1">
              <Input
                label="Mousehole URL (optional)"
                value={form.mouseholeUrl}
                onChange={(e) => updateField("mouseholeUrl", e.target.value)}
                placeholder="http://localhost:7001"
              />
              <InfoTip
                content="If you run Mousehole to manage your MAM seedbox IP, enter its URL here to see status and trigger updates from Tracker Tracker."
                size="sm"
                docs={{
                  href: "https://github.com/t-mart/mousehole",
                  description: "Mousehole on GitHub",
                }}
              />
            </div>
          )}

          <ColorPicker label="Color" value={form.color} onChange={(v) => updateField("color", v)} />

          {!(
            registryEntry?.gazelleEnrich ||
            tracker.platformType === "ggn" ||
            tracker.platformType === "avistaz" ||
            tracker.platformType === "digitalcore" ||
            tracker.platformType === "filelist" ||
            tracker.platformType === "iptorrents" ||
            tracker.platformType === "torrentleech" ||
            tracker.platformType === "retrotoon"
          ) && (
            <div>
              <label
                htmlFor="settings-joined-at"
                className="text-xs font-sans font-medium text-secondary uppercase tracking-wider mb-1 block"
              >
                Join Date
              </label>
              <input
                id="settings-joined-at"
                type="date"
                value={form.joinedAt}
                max={localDateStr()}
                onChange={(e) => updateField("joinedAt", e.target.value)}
                className={clsx(
                  "w-full font-mono text-sm text-primary cursor-pointer border-0",
                  "bg-control-bg px-4 py-3 nm-inset focus:outline-none rounded-nm-md",
                  !form.joinedAt && "text-muted"
                )}
                style={{ colorScheme: "dark" }}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <label
                htmlFor="settings-last-access-at"
                className="text-xs font-sans font-medium text-secondary uppercase tracking-wider"
              >
                Last Login
              </label>
              {/* Fills the date field only. Save still writes it. Unsaved edits
                  survive. */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateField("lastAccessAt", localDateStr())}
                disabled={saving || deleting}
                text="Today"
              />
            </div>
            <input
              id="settings-last-access-at"
              type="date"
              value={form.lastAccessAt}
              max={localDateStr()}
              onChange={(e) => updateField("lastAccessAt", e.target.value)}
              className={clsx(
                "w-full font-mono text-sm text-primary cursor-pointer border-0",
                "bg-control-bg px-4 py-3 nm-inset focus:outline-none rounded-nm-md",
                !form.lastAccessAt && "text-muted"
              )}
              style={{ colorScheme: "dark" }}
            />
            <p className="text-xs font-sans text-muted mt-1">
              {tracker.lastAccessAt
                ? `Currently recorded: ${tracker.lastAccessAt}`
                : "Not recorded yet."}
              {!hasLoginPolicy &&
                " This tracker has no login-interval policy, so no dashboard timer will appear. This is for your own records."}
            </p>
          </div>

          <Toggle
            label="Use proxy"
            checked={form.useProxy}
            onChange={(v) => updateField("useProxy", v)}
            disabled={!proxyAvailable || proxyAvailable === null}
            description={
              proxyAvailable
                ? "Route API requests for this tracker through the global proxy configured in Settings."
                : "No proxy configured. Enable a proxy in Settings first."
            }
          />

          <Toggle
            label="Count cross-seed towards unsatisfieds"
            checked={form.countCrossSeedUnsatisfied}
            onChange={(v) => updateField("countCrossSeedUnsatisfied", v)}
            description="Include cross-seeded torrents when calculating unsatisfied download requirements."
          />

          {(tracker.platformType === "mam" || tracker.platformType === "gazelle") && (
            <Toggle
              checked={form.hideUnreadBadges}
              onChange={(v) => updateField("hideUnreadBadges", v)}
              label="Hide unread badges"
              description="Don't show inbox/notification counts on this tracker's detail page"
            />
          )}

          <Notice message={errors.form} />

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-1 justify-end">
            <Button variant="ghost" onClick={handleClose} text="Cancel" />
            <Button type="submit" disabled={saving} text={saving ? "Saving..." : "Save Changes"} />
          </div>
        </form>

        {/* Danger zone */}
        <div className="border-t border-border pt-5 mt-1 flex flex-col gap-3">
          <span className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
            Danger Zone
          </span>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleArchive}
              disabled={saving}
              text={tracker.isActive ? "Archive" : "Reactivate"}
            />

            <ConfirmRemove
              label="Delete"
              confirmLabel="Confirm Delete"
              busyLabel="Deleting..."
              busy={deleting}
              onConfirm={handleDelete}
            />
          </div>
        </div>
      </div>
    </Sheet>
  )
}

export { TrackerSettingsSheet }
