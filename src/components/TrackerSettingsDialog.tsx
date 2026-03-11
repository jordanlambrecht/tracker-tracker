// src/components/TrackerSettingsDialog.tsx
//
// Functions: TrackerSettingsDialog

"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { ColorPicker } from "@/components/ui/ColorPicker"
import { Input } from "@/components/ui/Input"
import { MaskedSecret } from "@/components/ui/MaskedSecret"
import { QbtTagWarning } from "@/components/ui/QbtTagWarning"
import { Sheet } from "@/components/ui/Sheet"
import { Toggle } from "@/components/ui/Toggle"
import type { TrackerSummary } from "@/types/api"

interface TrackerSettingsDialogProps {
  open: boolean
  tracker: TrackerSummary
  onClose: () => void
  onUpdated: () => void
}

function TrackerSettingsDialog({ open, tracker, onClose, onUpdated }: TrackerSettingsDialogProps) {
  const router = useRouter()

  const [name, setName] = useState(tracker.name)
  const [color, setColor] = useState(tracker.color)
  const [qbtTag, setQbtTag] = useState(tracker.qbtTag ?? "")
  const [joinedAt, setJoinedAt] = useState(tracker.joinedAt ?? "")
  const [baseUrl, setBaseUrl] = useState(tracker.baseUrl)
  const [useProxy, setUseProxy] = useState(tracker.useProxy ?? false)
  const [countCrossSeedUnsatisfied, setCountCrossSeedUnsatisfied] = useState(tracker.countCrossSeedUnsatisfied ?? false)

  useEffect(() => {
    setName(tracker.name)
    setColor(tracker.color)
    setQbtTag(tracker.qbtTag ?? "")
    setJoinedAt(tracker.joinedAt ?? "")
    setBaseUrl(tracker.baseUrl)
    setUseProxy(tracker.useProxy ?? false)
    setCountCrossSeedUnsatisfied(tracker.countCrossSeedUnsatisfied ?? false)
  }, [tracker])

  const [proxyAvailable, setProxyAvailable] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setProxyAvailable(!!data.proxyEnabled) })
      .catch(() => {})
  }, [open])

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

  async function handleSave(e: FormEvent) {
    e.preventDefault()

    const validationErrors: Record<string, string> = {}
    if (!name.trim()) validationErrors.name = "Name is required"
    if (!baseUrl.trim()) {
      validationErrors.baseUrl = "Base URL is required"
    } else {
      try { new URL(baseUrl) } catch { validationErrors.baseUrl = "Invalid URL" }
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

    const payload: Record<string, unknown> = {
      name: name.trim(),
      color,
      baseUrl: baseUrl.trim(),
      qbtTag: qbtTag.trim(),
      joinedAt: joinedAt || null,
      useProxy,
      countCrossSeedUnsatisfied,
    }

    if (changingKey && newApiToken.trim()) {
      payload.apiToken = newApiToken
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name for this tracker"
            error={errors.name}
          />

          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
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
                  value={newApiToken}
                  onChange={(e) => setNewApiToken(e.target.value)}
                  placeholder="Paste API token"
                  error={errors.apiToken}
                />
                <button
                  type="button"
                  onClick={() => { setChangingKey(false); setNewApiToken(""); setErrors({}) }}
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
              value={qbtTag}
              onChange={(e) => setQbtTag(e.target.value)}
              placeholder="i.e, aither"
            />
            <QbtTagWarning tag={qbtTag} />
          </div>

          <ColorPicker label="Color" value={color} onChange={setColor} />

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
              value={joinedAt}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setJoinedAt(e.target.value)}
              className={clsx(
                "w-full font-mono text-sm text-primary cursor-pointer border-0",
                "bg-control-bg px-4 py-3 nm-inset focus:outline-none rounded-nm-md",
                !joinedAt && "text-muted",
              )}
              style={{ colorScheme: "dark" }}
            />
          </div>

          <Toggle
            label="Use proxy"
            checked={useProxy}
            onChange={setUseProxy}
            disabled={!proxyAvailable}
            description={proxyAvailable
              ? "Route API requests for this tracker through the global proxy configured in Settings."
              : "No proxy configured. Enable a proxy in Settings first."
            }
          />

          <Toggle
            label="Count cross-seed towards unsatisfieds"
            checked={countCrossSeedUnsatisfied}
            onChange={setCountCrossSeedUnsatisfied}
            description="Include cross-seeded torrents when calculating unsatisfied download requirements."
          />

          {errors.form && (
            <p className="text-xs font-sans text-danger" role="alert">
              {errors.form}
            </p>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-1 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
            >
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
