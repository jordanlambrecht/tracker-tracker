"use client"
// src/components/AddTrackerDialog.tsx
//
// Functions: AddTrackerDialog

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"

interface AddTrackerDialogProps {
  open: boolean
  onClose: () => void
  onAdded: (trackerId: number) => void
}

function AddTrackerDialog({ open, onClose, onAdded }: AddTrackerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [qbtTag, setQbtTag] = useState("")
  const [pollInterval, setPollInterval] = useState("360")
  const [color, setColor] = useState("#00d4ff")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ username: string; group: string } | null>(null)

  const resetForm = useCallback(() => {
    setName("")
    setBaseUrl("")
    setApiToken("")
    setQbtTag("")
    setPollInterval("360")
    setColor("#00d4ff")
    setErrors({})
    setLoading(false)
    setTestResult(null)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleNativeClose() {
      resetForm()
      onClose()
    }

    dialog.addEventListener("close", handleNativeClose)
    return () => {
      dialog.removeEventListener("close", handleNativeClose)
    }
  }, [onClose, resetForm])

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  function handleDialogKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "Escape") {
      dialogRef.current?.close()
    }
  }

  function selectPreset(slug: string) {
    const entry = TRACKER_REGISTRY.find((t) => t.slug === slug)
    if (entry) {
      setName(entry.name)
      setBaseUrl(entry.url)
      setColor(entry.color)
      setErrors({})
      setTestResult(null)
    }
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}

    if (!name.trim()) {
      next.name = "Tracker name is required"
    }
    if (!baseUrl.trim()) {
      next.baseUrl = "Base URL is required"
    } else {
      try {
        new URL(baseUrl)
      } catch {
        next.baseUrl = "Invalid URL format"
      }
    }
    if (!apiToken.trim()) {
      next.apiToken = "API token is required"
    }

    return next
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setLoading(true)
    setTestResult(null)

    try {
      const testRes = await fetch("/api/trackers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiToken, platformType: "unit3d" }),
      })

      const testData = await testRes.json()

      if (!testRes.ok) {
        setErrors({ apiToken: testData.error ?? "Connection failed" })
        setLoading(false)
        return
      }

      setTestResult({ username: testData.username, group: testData.group })

      const saveRes = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          baseUrl,
          apiToken,
          pollIntervalMinutes: parseInt(pollInterval, 10),
          color,
          qbtTag: qbtTag.trim() || undefined,
        }),
      })

      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        setErrors({ form: saveData.error ?? "Failed to add tracker" })
        setLoading(false)
        return
      }

      resetForm()
      onAdded(saveData.id)
    } catch {
      setErrors({ form: "Network error — please try again" })
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleDialogKeyDown}
      className={[
        "fixed inset-0 m-auto",
        "w-full max-w-lg",
        "bg-raised border border-border rounded-lg",
        "p-0 overflow-visible",
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col",
      ].join(" ")}
    >
      <div className="flex flex-col w-full p-6 gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-primary">Add Tracker</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-tertiary hover:text-primary transition-colors cursor-pointer p-1 -m-1 rounded"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {TRACKER_REGISTRY.map((preset) => (
            <button
              key={preset.slug}
              type="button"
              onClick={() => selectPreset(preset.slug)}
              className={[
                "px-3 py-1.5 rounded text-xs border transition-all cursor-pointer",
                name === preset.name
                  ? "border-accent/40 bg-accent-dim text-accent"
                  : "border-border text-tertiary hover:text-secondary hover:border-border-emphasis",
              ].join(" ")}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Tracker Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Aither"
            error={errors.name}
          />

          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://aither.cc"
            error={errors.baseUrl}
          />

          <div className="flex flex-col gap-1.5">
            <Input
              label="API Token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your UNIT3D API token"
              error={errors.apiToken}
            />
            {testResult && (
              <p className="text-xs font-sans text-success">
                Connected as <span className="font-semibold">{testResult.username}</span>
                {testResult.group ? ` (${testResult.group})` : ""}
              </p>
            )}
          </div>

          <Input
            label="qBittorrent Tag"
            value={qbtTag}
            onChange={(e) => setQbtTag(e.target.value)}
            placeholder="e.g., aither"
          />

          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="dialog-poll-interval"
                className="text-xs font-sans font-medium text-secondary uppercase tracking-wider mb-1.5 block"
              >
                Poll Interval
              </label>
              <select
                id="dialog-poll-interval"
                value={pollInterval}
                onChange={(e) => setPollInterval(e.target.value)}
                className={[
                  "w-full rounded-md bg-control-bg border border-control-border",
                  "px-3 py-2 text-sm text-primary font-mono cursor-pointer",
                  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-control-focus",
                ].join(" ")}
              >
                <option value="60">Every hour</option>
                <option value="180">Every 3 hours</option>
                <option value="360">Every 6 hours</option>
                <option value="720">Every 12 hours</option>
                <option value="1440">Every 24 hours</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="dialog-color"
                className="text-xs font-sans font-medium text-secondary uppercase tracking-wider mb-1.5 block"
              >
                Color
              </label>
              <input
                id="dialog-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={[
                  "h-[38px] w-14 rounded-md bg-control-bg border border-control-border",
                  "px-1 py-1 cursor-pointer",
                  "focus:outline-none focus:border-accent",
                ].join(" ")}
              />
            </div>
          </div>

          {errors.form && (
            <p className="text-xs font-sans text-danger" role="alert">
              {errors.form}
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading}>
              {loading ? "Connecting..." : "Add Tracker"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

export { AddTrackerDialog }
