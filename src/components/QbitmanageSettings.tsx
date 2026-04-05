// src/components/QbitmanageSettings.tsx
"use client"

import { Subtext } from "@typography"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Checkbox } from "@/components/ui/Checkbox"
import { Input } from "@/components/ui/Input"
import { SaveDiscardBar } from "@/components/ui/SaveDiscardBar"
import { Toggle } from "@/components/ui/Toggle"
import { DOCS } from "@/lib/constants"
import { QBITMANAGE_TAG_DEFAULTS } from "@/lib/qbt/qbitmanage-defaults"
import type { QbitmanageTagConfig } from "@/types/api"

const QBITMANAGE_STATUSES = [
  { key: "issue" as const, label: "Issue", defaultTag: "issue" },
  {
    key: "minTimeNotReached" as const,
    label: "Min Time Not Reached",
    defaultTag: "MinTimeNotReached",
  },
  { key: "noHardlinks" as const, label: "No Hardlinks", defaultTag: "noHL" },
  { key: "minSeedsNotMet" as const, label: "Min Seeds Not Met", defaultTag: "MinSeedsNotMet" },
  {
    key: "lastActiveLimitNotReached" as const,
    label: "Last Active Limit Not Reached",
    defaultTag: "LastActiveLimitNotReached",
  },
  {
    key: "lastActiveNotReached" as const,
    label: "Last Active Not Reached",
    defaultTag: "LastActiveNotReached",
  },
]

interface QbitmanageSettingsProps {
  initialEnabled: boolean
  initialTags: QbitmanageTagConfig
}

function QbitmanageSettings({ initialEnabled, initialTags }: QbitmanageSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [config, setConfig] = useState<QbitmanageTagConfig>({
    ...QBITMANAGE_TAG_DEFAULTS,
    ...initialTags,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  function updateEntry(
    key: keyof QbitmanageTagConfig,
    patch: Partial<QbitmanageTagConfig[typeof key]>
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
    <SettingsSection
      id="qbitmanage"
      title="qbitmanage Tag Tracking"
      tooltip="Categorize torrents by qbitmanage status tags."
      docs={DOCS.QBITMANAGE}
      cardClassName="flex flex-col gap-4"
    >
      <Subtext>Categorize torrents by status tags written by qbitmanage.</Subtext>

      <Toggle
        label="Enable qbitmanage Tag Tracking"
        checked={enabled}
        onChange={(val) => {
          setEnabled(val)
          setDirty(true)
        }}
      />

      {enabled && (
        <>
          <div className="border-t border-border" />

          <Subtext>Map each qbitmanage status to its qBittorrent tag name.</Subtext>

          {QBITMANAGE_STATUSES.map((status) => (
            <div
              key={status.key}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
            >
              <div className="flex items-center gap-2 sm:w-56 sm:shrink-0">
                <Checkbox
                  checked={config[status.key].enabled}
                  onChange={(checked) => updateEntry(status.key, { enabled: checked })}
                />
                <span className="text-sm font-sans text-secondary">{status.label}</span>
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

          <SaveDiscardBar
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            error={saveError}
            success={saved ? "Saved" : null}
            showDivider={false}
          />
        </>
      )}
    </SettingsSection>
  )
}

export { QbitmanageSettings }
