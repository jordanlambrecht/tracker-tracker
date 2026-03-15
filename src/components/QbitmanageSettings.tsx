// src/components/QbitmanageSettings.tsx
//
// Functions: QbitmanageSettings

"use client"

import { H3, Subtext } from "@typography"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Checkbox } from "@/components/ui/Checkbox"
import { Input } from "@/components/ui/Input"
import { Toggle } from "@/components/ui/Toggle"
import { QBITMANAGE_TAG_DEFAULTS } from "@/lib/qbitmanage-defaults"
import type { QbitmanageTagConfig } from "@/types/api"

const QBITMANAGE_STATUSES = [
  { key: "issue" as const, label: "Issue", defaultTag: "issue" },
  { key: "minTimeNotReached" as const, label: "Min Time Not Reached", defaultTag: "MinTimeNotReached" },
  { key: "noHardlinks" as const, label: "No Hardlinks", defaultTag: "noHL" },
  { key: "minSeedsNotMet" as const, label: "Min Seeds Not Met", defaultTag: "MinSeedsNotMet" },
  { key: "lastActiveLimitNotReached" as const, label: "Last Active Limit Not Reached", defaultTag: "LastActiveLimitNotReached" },
  { key: "lastActiveNotReached" as const, label: "Last Active Not Reached", defaultTag: "LastActiveNotReached" },
]

function QbitmanageSettings() {
  const [enabled, setEnabled] = useState(false)
  const [config, setConfig] = useState<QbitmanageTagConfig>(QBITMANAGE_TAG_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return
        if (typeof data.qbitmanageEnabled === "boolean") {
          if (!cancelled) setEnabled(data.qbitmanageEnabled)
        }
        if (data.qbitmanageTags && typeof data.qbitmanageTags === "object") {
          if (!cancelled) setConfig({ ...QBITMANAGE_TAG_DEFAULTS, ...data.qbitmanageTags })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function updateEntry(
    key: keyof QbitmanageTagConfig,
    patch: Partial<QbitmanageTagConfig[typeof key]>,
  ) {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qbitmanageEnabled: enabled,
          qbitmanageTags: config,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError((body as { error?: string }).error ?? `Server error (${res.status})`)
        return
      }
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error — could not save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <H3 className="mb-1">qbitmanage Tag Tracking</H3>
        <Subtext>Categorize torrents by status tags written by qbitmanage.</Subtext>
      </div>

      <Toggle
        label="Enable qbitmanage Tag Tracking"
        checked={enabled}
        onChange={(val) => { setEnabled(val); setDirty(true) }}
      />

      {enabled && (
        <Card elevation="raised" className="flex flex-col gap-4 mt-2">
          <Subtext>Map each qbitmanage status to its qBittorrent tag name.</Subtext>

          {QBITMANAGE_STATUSES.map((status) => (
            <div key={status.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:w-56 sm:shrink-0">
                <Checkbox
                  checked={config[status.key].enabled}
                  onChange={(checked) => updateEntry(status.key, { enabled: checked })}
                />
                <span className="text-sm font-sans text-secondary">
                  {status.label}
                </span>
              </div>
              <Input
                value={config[status.key].tag}
                onChange={(e) => updateEntry(status.key, { tag: e.target.value })}
                placeholder={status.defaultTag}
                disabled={!config[status.key].enabled}
                className="py-2"
              />
            </div>
          ))}

          <div className="flex flex-col gap-1.5 pt-2">
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? "Saving..." : "Save"}
              </Button>
              {saved && (
                <span className="text-xs font-mono text-success">Saved</span>
              )}
            </div>
            {saveError && (
              <span className="text-xs font-mono text-danger">{saveError}</span>
            )}
          </div>
        </Card>
      )}
    </section>
  )
}

export { QbitmanageSettings }
