// src/components/TrackerSettingsDialog.tsx
//
// Functions: TrackerSettingsDialog

"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { type SyntheticEvent, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { ColorPicker } from "@/components/ui/ColorPicker"
import { Input } from "@/components/ui/Input"
import { MaskedSecret } from "@/components/ui/MaskedSecret"
import { QbtTagWarning } from "@/components/ui/QbtTagWarning"
import { Sheet } from "@/components/ui/Sheet"
import { Toggle } from "@/components/ui/Toggle"
import { Tooltip } from "@/components/ui/Tooltip"
import { findRegistryEntry } from "@/data/tracker-registry"
import type { TrackerSummary } from "@/types/api"

interface TrackerSettingsDialogProps {
  open: boolean
  tracker: TrackerSummary
  onClose: () => void
  onUpdated: () => void
}

interface FormState {
  name: string
  color: string
  qbtTag: string
  joinedAt: string
  baseUrl: string
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
    baseUrl: t.baseUrl,
    useProxy: t.useProxy ?? false,
    countCrossSeedUnsatisfied: t.countCrossSeedUnsatisfied ?? false,
    hideUnreadBadges: t.hideUnreadBadges ?? false,
    mouseholeUrl: t.mouseholeUrl ?? "",
  }
}

function TrackerSettingsDialog({ open, tracker, onClose, onUpdated }: TrackerSettingsDialogProps) {
  const router = useRouter()

  const [form, setForm] = useState<FormState>(() => formStateFromTracker(tracker))
  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    setForm(formStateFromTracker(tracker))
  }, [tracker])

  const registryEntry = findRegistryEntry(tracker.baseUrl)

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
  const [newApiToken, setNewApiToken] = useState("")

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const resetTransientState = useCallback(() => {
    setChangingKey(false)
    setNewApiToken("")
    setErrors({})
    setSaving(false)
    setConfirmDelete(false)
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
    if (!form.baseUrl.trim()) {
      validationErrors.baseUrl = "Base URL is required"
    } else {
      try {
        new URL(form.baseUrl)
      } catch {
        validationErrors.baseUrl = "Invalid URL"
      }
    }
    if (changingKey && !newApiToken.trim()) {
      validationErrors.apiToken = "API token cannot be empty"
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSaving(true)

    const trimmedToken = newApiToken.trim()

    // Test the new API key before saving
    if (changingKey && trimmedToken) {
      try {
        const testRes = await fetch("/api/trackers/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: form.baseUrl.trim(),
            apiToken: trimmedToken,
            platformType: tracker.platformType,
          }),
        })
        if (!testRes.ok) {
          const testData = await testRes.json().catch(() => ({ error: "Connection failed" }))
          setErrors({ apiToken: (testData as { error?: string }).error ?? "Connection failed" })
          setSaving(false)
          return
        }
      } catch {
        setErrors({ apiToken: "Could not verify API key — check your connection" })
        setSaving(false)
        return
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      color: form.color,
      baseUrl: form.baseUrl.trim(),
      qbtTag: form.qbtTag.trim(),
      joinedAt: form.joinedAt || null,
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

      resetTransientState()
      onUpdated()
      onClose()
    } catch {
      setErrors({ form: "Network error — please try again" })
      setSaving(false)
    }
  }

  async function handleArchive() {
    setSaving(true)
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tracker.isActive }),
      })

      if (res.ok) {
        onUpdated()
        onClose()
      }
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
    <Sheet open={open} onClose={handleClose} title="Tracker Settings">
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

          <Input
            label="Base URL"
            value={form.baseUrl}
            onChange={(e) => updateField("baseUrl", e.target.value)}
            placeholder="https://aither.cc"
            error={errors.baseUrl}
          />

          {/* API Key — show status or change input */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
              API Key
            </span>
            {changingKey ? (
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  data-1p-ignore
                  value={newApiToken}
                  onChange={(e) => setNewApiToken(e.target.value)}
                  placeholder="Paste API token"
                  error={errors.apiToken}
                />
                <button
                  type="button"
                  onClick={() => {
                    setChangingKey(false)
                    setNewApiToken("")
                    setErrors({})
                  }}
                  className="text-xs font-mono text-tertiary hover:text-secondary transition-colors cursor-pointer self-start"
                >
                  Cancel
                </button>
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
              <Tooltip
                content="If you run Mousehole to manage your MAM seedbox IP, enter its URL here to see status and trigger updates from Tracker Tracker."
                docs={{
                  href: "https://github.com/t-mart/mousehole",
                  description: "Mousehole on GitHub",
                }}
              >
                <span className="text-muted hover:text-secondary cursor-help text-xs">&#9432;</span>
              </Tooltip>
            </div>
          )}

          <ColorPicker label="Color" value={form.color} onChange={(v) => updateField("color", v)} />

          {!(registryEntry?.gazelleEnrich || tracker.platformType === "ggn") && (
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
                max={new Date().toISOString().split("T")[0]}
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

          {errors.form && (
            <p className="text-xs font-sans text-danger" role="alert">
              {errors.form}
            </p>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-1 justify-end">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

        {/* Danger zone */}
        <div className="border-t border-border pt-5 mt-1 flex flex-col gap-3">
          <span className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
            Danger Zone
          </span>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleArchive}
              disabled={saving}
            >
              {tracker.isActive ? "Archive" : "Reactivate"}
            </Button>

            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

export { TrackerSettingsDialog }
