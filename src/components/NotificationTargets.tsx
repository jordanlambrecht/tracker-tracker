// src/components/NotificationTargets.tsx
//
// Functions: NotificationTargets, NotificationCard, AddNotificationForm

"use client"

import { H2, H3, Paragraph, Subtext } from "@typography"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { CollapsibleCard } from "@/components/ui/CollapsibleCard"
import { ConfirmRemove } from "@/components/ui/ConfirmRemove"
import { Input } from "@/components/ui/Input"
import { MaskedSecret } from "@/components/ui/MaskedSecret"
import { NumberInput } from "@/components/ui/NumberInput"
import { SaveDiscardBar } from "@/components/ui/SaveDiscardBar"
import { Select } from "@/components/ui/Select"
import { Toggle } from "@/components/ui/Toggle"
import { Tooltip } from "@/components/ui/Tooltip"
import { useActionStatus } from "@/hooks/useActionStatus"
import { DOCS } from "@/lib/constants"
import { formatTimeAgo } from "@/lib/formatters"
import type { NotificationTargetType } from "@/lib/notifications/types"

interface NotificationTarget {
  id: number
  name: string
  type: NotificationTargetType
  enabled: boolean
  hasConfig: boolean
  notifyRatioDrop: boolean
  notifyHitAndRun: boolean
  notifyTrackerDown: boolean
  notifyBufferMilestone: boolean
  notifyWarned: boolean
  notifyRatioDanger: boolean
  notifyZeroSeeding: boolean
  notifyRankChange: boolean
  notifyAnniversary: boolean
  notifyBonusCap: boolean
  notifyVipExpiring: boolean
  notifyUnsatisfiedLimit: boolean
  notifyActiveHnrs: boolean
  thresholds: { ratioDropDelta?: number; bufferMilestoneBytes?: number } | null
  includeTrackerName: boolean
  scope: number[] | null
  lastDeliveryStatus: string | null
  lastDeliveryAt: string | null
  lastDeliveryError: string | null
  createdAt: string
  updatedAt: string
}

const NOTIFICATION_TYPE_OPTIONS: {
  value: NotificationTargetType
  label: string
  disabled?: boolean
}[] = [
  { value: "discord", label: "Discord" },
  { value: "gotify", label: "Gotify (coming soon)", disabled: true },
  { value: "telegram", label: "Telegram (coming soon)", disabled: true },
  { value: "slack", label: "Slack (coming soon)", disabled: true },
  { value: "email", label: "Email (coming soon)", disabled: true },
]

// ---------------------------------------------------------------------------
// NotificationCard
// ---------------------------------------------------------------------------

interface NotificationCardProps {
  target: NotificationTarget
  onSaved: (id: number, updated: NotificationTarget) => void
  onRemove: (id: number) => void
}

/** Fields tracked for dirty detection (excludes transient fields). */
const DRAFT_KEYS: (keyof NotificationTarget)[] = [
  "name",
  "type",
  "enabled",
  "notifyRatioDrop",
  "notifyHitAndRun",
  "notifyTrackerDown",
  "notifyBufferMilestone",
  "notifyWarned",
  "notifyRatioDanger",
  "notifyZeroSeeding",
  "notifyRankChange",
  "notifyAnniversary",
  "notifyBonusCap",
  "notifyVipExpiring",
  "notifyUnsatisfiedLimit",
  "notifyActiveHnrs",
  "thresholds",
  "includeTrackerName",
  "scope",
]

function buildPatch(
  draft: NotificationTarget,
  saved: NotificationTarget
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  for (const key of DRAFT_KEYS) {
    const a = draft[key]
    const b = saved[key]
    if (a === null && b === null) continue
    if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
      if (JSON.stringify(a) !== JSON.stringify(b)) patch[key] = a
    } else if (a !== b) patch[key] = a
  }
  return Object.keys(patch).length > 0 ? patch : null
}

function NotificationCard({ target, onSaved, onRemove }: NotificationCardProps) {
  const [draft, setDraft] = useState<NotificationTarget>(target)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const { status: webhookStatus, error: webhookError, execute: executeTest } = useActionStatus()

  const dirty = buildPatch(draft, target) !== null

  // Sync draft when parent pushes new server state
  useEffect(() => {
    if (!dirty) setDraft(target)
  }, [target, dirty])

  function updateDraft(patch: Partial<NotificationTarget>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function updateThreshold(patch: Partial<NonNullable<NotificationTarget["thresholds"]>>) {
    setDraft((prev) => ({
      ...prev,
      thresholds: { ...(prev.thresholds ?? {}), ...patch },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const patch = buildPatch(draft, target)
    if (!patch) return
    try {
      const res = await fetch(`/api/notifications/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaveError(data.error || "Failed to save")
        return
      }
      onSaved(target.id, draft)
    } catch {
      setSaveError("Network error")
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setDraft(target)
    setSaveError(null)
  }

  // Webhook config change state
  const [changingConfig, setChangingConfig] = useState(!target.hasConfig)
  const [newWebhookUrl, setNewWebhookUrl] = useState("")
  const [configError, setConfigError] = useState<string | null>(null)

  async function handleSaveConfig() {
    if (!newWebhookUrl.trim()) return
    setConfigError(null)
    try {
      const res = await fetch(`/api/notifications/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { webhookUrl: newWebhookUrl.trim() } }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setConfigError(data.error || "Failed to save webhook URL")
        return
      }
      onSaved(target.id, { ...target, hasConfig: true })
      setChangingConfig(false)
      setNewWebhookUrl("")
    } catch {
      setConfigError("Network error — could not save webhook URL")
    }
  }

  const handleTestWebhook = () =>
    executeTest(async () => {
      const res = await fetch(`/api/notifications/${target.id}/test`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Test failed")
      }
    })

  const ratioDropDelta = draft.thresholds?.ratioDropDelta ?? 0.1

  const statusBadge = draft.enabled ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="default">Disabled</Badge>
  )

  const typeBadge = (
    <Badge variant="default">
      {NOTIFICATION_TYPE_OPTIONS.find((o) => o.value === draft.type)?.label ?? draft.type}
    </Badge>
  )

  return (
    <CollapsibleCard
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
      header={
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <H3 className="truncate">{draft.name || "Untitled Target"}</H3>
            {typeBadge}
            {statusBadge}
          </div>
          <span className="text-3xs font-mono text-tertiary">
            {target.lastDeliveryAt
              ? `Last sent: ${formatTimeAgo(target.lastDeliveryAt)}`
              : "Last sent: Never"}
          </span>
        </div>
      }
    >
      {/* Row 1: Name + Type + Enabled */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-end pt-5">
        <div className="flex-1">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="My Discord Webhook"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Type"
            value={draft.type}
            onChange={(v) => updateDraft({ type: v as NotificationTargetType })}
            ariaLabel="Notification type"
            size="md"
            options={NOTIFICATION_TYPE_OPTIONS}
          />
        </div>
      </div>

      <Toggle
        label="Enabled"
        checked={draft.enabled}
        onChange={(v) => updateDraft({ enabled: v })}
        description="Disabled targets will not receive any notifications."
      />

      <div className="border-t border-border" />

      {/* Webhook URL */}
      <div className="flex flex-col gap-2">
        <H2 className="uppercase tracking-wider flex items-center gap-1.5">
          Webhook URL
          <Tooltip
            content="Encrypted at rest with AES-256-GCM. Never returned in API responses."
            docs={DOCS.WEBHOOKS}
          >
            <span className="text-tertiary cursor-help text-3xs">?</span>
          </Tooltip>
        </H2>
        {changingConfig ? (
          <div className="flex flex-col gap-3">
            <Input
              label="Webhook URL"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              name="notification-webhook-url"
              autoComplete="off"
              data-1p-ignore
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSaveConfig}
                disabled={!newWebhookUrl.trim()}
                text="Save URL"
              />
              {target.hasConfig && (
                <button
                  type="button"
                  onClick={() => {
                    setChangingConfig(false)
                    setNewWebhookUrl("")
                    setConfigError(null)
                  }}
                  className="ghost-link"
                >
                  Cancel
                </button>
              )}
            </div>
            {configError && <p className="text-xs font-mono text-danger">{configError}</p>}
          </div>
        ) : (
          <MaskedSecret onChangeClick={() => setChangingConfig(true)} />
        )}
      </div>

      <div className="border-t border-border" />

      {/* Notify when section */}
      <div className="flex flex-col gap-4">
        <H2 className="uppercase tracking-wider flex items-center gap-1.5">
          Notify when
          <Tooltip
            content="Each event has a snooze window to prevent repeated alerts."
            docs={DOCS.WEBHOOKS}
          >
            <span className="text-tertiary cursor-help text-3xs">?</span>
          </Tooltip>
        </H2>

        <div className="flex flex-col gap-1">
          <Toggle
            label="Ratio drops"
            checked={draft.notifyRatioDrop}
            onChange={(v) => updateDraft({ notifyRatioDrop: v })}
          />
          {draft.notifyRatioDrop && (
            <div className="ml-15 flex items-center gap-3">
              <span className="text-xs font-mono text-tertiary">Threshold (delta)</span>
              <NumberInput
                value={Math.round(ratioDropDelta * 100)}
                onChange={(v) => updateThreshold({ ratioDropDelta: v / 100 })}
                min={1}
                max={99}
                step={1}
              />
              <span className="text-xs font-mono text-tertiary">/ 100</span>
            </div>
          )}
        </div>

        <Toggle
          label="Hit-and-run detected"
          checked={draft.notifyHitAndRun}
          onChange={(v) => updateDraft({ notifyHitAndRun: v })}
        />

        <Toggle
          label="Tracker goes down"
          checked={draft.notifyTrackerDown}
          onChange={(v) => updateDraft({ notifyTrackerDown: v })}
        />

        <Toggle
          label="Buffer milestone reached"
          checked={draft.notifyBufferMilestone}
          onChange={(v) => updateDraft({ notifyBufferMilestone: v })}
        />

        <Toggle
          label="Account warning received"
          checked={draft.notifyWarned}
          onChange={(v) => updateDraft({ notifyWarned: v })}
        />

        <Toggle
          label="Ratio below tracker minimum"
          checked={draft.notifyRatioDanger}
          onChange={(v) => updateDraft({ notifyRatioDanger: v })}
        />

        <Toggle
          label="Zero active seeds"
          checked={draft.notifyZeroSeeding}
          onChange={(v) => updateDraft({ notifyZeroSeeding: v })}
        />

        <Toggle
          label="Rank/class changed"
          checked={draft.notifyRankChange}
          onChange={(v) => updateDraft({ notifyRankChange: v })}
        />

        <Toggle
          label="Membership anniversary"
          checked={draft.notifyAnniversary}
          onChange={(v) => updateDraft({ notifyAnniversary: v })}
        />

        <Toggle
          label="Bonus Points Capped"
          checked={draft.notifyBonusCap}
          onChange={(v) => updateDraft({ notifyBonusCap: v })}
          description="Alert when seedbonus hits the cap (99,999 on MAM)"
        />

        <Toggle
          label="VIP Expiring Soon"
          checked={draft.notifyVipExpiring}
          onChange={(v) => updateDraft({ notifyVipExpiring: v })}
          description="Alert when VIP status is about to expire"
        />

        <Toggle
          label="Unsatisfied Limit Warning"
          checked={draft.notifyUnsatisfiedLimit}
          onChange={(v) => updateDraft({ notifyUnsatisfiedLimit: v })}
          description="Alert when approaching the unsatisfied torrent limit"
        />

        <Toggle
          label="Active Hit & Runs"
          checked={draft.notifyActiveHnrs}
          onChange={(v) => updateDraft({ notifyActiveHnrs: v })}
          description="Alert when inactive Hit & Runs are detected"
        />
      </div>

      <div className="border-t border-border" />

      {/* Privacy section */}
      <div className="flex flex-col gap-3">
        <Toggle
          label="Include tracker name in notifications"
          checked={draft.includeTrackerName}
          onChange={(v) => updateDraft({ includeTrackerName: v })}
        />
        <Subtext>
          Tracker names reveal which private trackers you use. Disable for maximum privacy.
        </Subtext>
      </div>

      <SaveDiscardBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        error={saveError}
      />

      <div className="border-t border-border" />

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleTestWebhook}
          disabled={webhookStatus === "pending" || !target.hasConfig}
        >
          {webhookStatus === "pending"
            ? "Sending..."
            : webhookStatus === "success"
              ? "Sent"
              : webhookStatus === "failed"
                ? "Failed — Retry"
                : "Test Webhook"}
        </Button>

        {webhookStatus === "success" && <Badge variant="success">Delivered</Badge>}
        {webhookStatus === "failed" && <Badge variant="danger">Failed</Badge>}

        <div className="flex-1" />

        <ConfirmRemove onConfirm={() => onRemove(target.id)} />
      </div>
      {webhookStatus === "failed" && webhookError && (
        <p className="text-xs font-mono text-danger">{webhookError}</p>
      )}
    </CollapsibleCard>
  )
}

// ---------------------------------------------------------------------------
// AddNotificationForm
// ---------------------------------------------------------------------------

function AddNotificationForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState("New Target")
  const [type, setType] = useState<NotificationTargetType>("discord")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSubmit = name.trim() && webhookUrl.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          config: { webhookUrl: webhookUrl.trim() },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to create target")
        return
      }
      onCreated()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card elevation="raised" className="flex flex-col gap-4">
      <H3>Add Notification Target</H3>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
        <div className="flex-1">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Discord Webhook"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Type"
            value={type}
            onChange={(v) => setType(v as NotificationTargetType)}
            ariaLabel="Notification type"
            size="md"
            options={NOTIFICATION_TYPE_OPTIONS}
          />
        </div>
      </div>
      <Input
        label="Webhook URL"
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
        placeholder="https://discord.com/api/webhooks/..."
        name="new-notification-webhook-url"
        autoComplete="off"
        data-1p-ignore
      />
      {error && <p className="text-sm font-mono text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || saving} text={saving ? "Creating..." : "Create Target"} />
        <Button size="sm" variant="ghost" onClick={onCancel} text="Cancel" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// NotificationTargets
// ---------------------------------------------------------------------------

function NotificationTargets() {
  const [targets, setTargets] = useState<NotificationTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data: NotificationTarget[] = await res.json()
      setTargets(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  const handleSaved = useCallback((id: number, updated: NotificationTarget) => {
    setTargets((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }, [])

  const handleRemove = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" })
      if (!res.ok) return
      setTargets((prev) => prev.filter((t) => t.id !== id))
    } catch {
      // Fire-and-forget delete — silently ignore network errors
    }
  }, [])

  if (loading) {
    return <p className="text-sm font-mono text-tertiary">Loading notification targets...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <H2 className="flex items-center gap-2">
        Webhooks
        <Tooltip content="Get alerts when something happens on your trackers." docs={DOCS.WEBHOOKS}>
          <span className="text-muted hover:text-secondary cursor-help text-sm">&#9432;</span>
        </Tooltip>
      </H2>
      {targets.length === 0 && !showAddForm ? (
        <Card elevation="raised" className="flex flex-col items-center gap-4 py-10">
          <span className="text-2xl" aria-hidden="true">
            🔔
          </span>
          <div className="text-center flex flex-col gap-2">
            <H3>No notification targets configured</H3>
            <Paragraph>
              Add a notification target to receive alerts when your tracker stats change.
            </Paragraph>
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)} text="Add Notification Target" />
        </Card>
      ) : (
        <>
          {targets.map((target) => (
            <NotificationCard
              key={target.id}
              target={target}
              onSaved={handleSaved}
              onRemove={handleRemove}
            />
          ))}
          {showAddForm ? (
            <AddNotificationForm
              onCreated={() => {
                setShowAddForm(false)
                fetchTargets()
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() => setShowAddForm(true)}
              text="+ Add Notification Target"
            />
          )}
        </>
      )}
    </div>
  )
}

export { NotificationTargets }
