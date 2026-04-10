// src/components/NotificationTargets.tsx
//
// Functions: NotificationTargets, NotificationCard, AddNotificationForm
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { H2, H3, Paragraph } from "@typography"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { CollapsibleCard } from "@/components/ui/CollapsibleCard"
import { ConfirmRemove } from "@/components/ui/ConfirmRemove"
import { InfoTip } from "@/components/ui/InfoTip"
import { Input } from "@/components/ui/Input"
import { MaskedSecret } from "@/components/ui/MaskedSecret"
import { Notice } from "@/components/ui/Notice"
import { NumberInput } from "@/components/ui/NumberInput"
import { SaveDiscardBar } from "@/components/ui/SaveDiscardBar"
import { Select } from "@/components/ui/Select"
import { CardListSkeleton } from "@/components/ui/skeletons"
import { Toggle } from "@/components/ui/Toggle"
import { useActionStatus } from "@/hooks/useActionStatus"
import { useCrudCard } from "@/hooks/useCrudCard"
import { DOCS } from "@/lib/constants"
import { formatTimeAgo } from "@/lib/formatters"
import type { NotificationTargetType } from "@/lib/notifications/types"
import type { SafeNotificationTarget } from "@/types/api"

type NotificationTarget = SafeNotificationTarget

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
  "notifyDownloadDisabled",
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
  const {
    draft,
    setDraft,
    updateDraft,
    dirty,
    saving,
    saveError,
    expanded,
    toggleExpand,
    handleSave,
    handleDiscard,
  } = useCrudCard({
    item: target,
    apiEndpoint: "/api/notifications",
    buildPatch,
    onSaved,
  })
  const { status: webhookStatus, error: webhookError, execute: executeTest } = useActionStatus()

  function updateThreshold(patch: Partial<NonNullable<NotificationTarget["thresholds"]>>) {
    setDraft((prev) => ({
      ...prev,
      thresholds: { ...(prev.thresholds ?? {}), ...patch },
    }))
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
      onToggle={toggleExpand}
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
      <div className="form-responsive-row pt-5">
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
        <H2 className="uppercase tracking-wider flex items-center gap-2">
          Webhook URL
          <InfoTip
            icon="question"
            size="sm"
            content="Encrypted at rest with AES-256-GCM. Never returned in API responses."
            docs={DOCS.WEBHOOKS}
          />
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
            <Notice message={configError} />
          </div>
        ) : (
          <MaskedSecret onChangeClick={() => setChangingConfig(true)} />
        )}
      </div>

      <div className="border-t border-border" />

      {/* Notify when section */}
      <div className="flex flex-col gap-4">
        <H2 className="uppercase tracking-wider flex items-center gap-2">
          Notify when
          <InfoTip
            icon="question"
            size="sm"
            content="Each event has a snooze window to prevent repeated alerts."
            docs={DOCS.WEBHOOKS}
          />
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
          description="Alert when seedbonus hits the cap (i.e. 99,999 on MAM)"
        />

        <Toggle
          label="VIP Expiring Soon"
          checked={draft.notifyVipExpiring}
          onChange={(v) => updateDraft({ notifyVipExpiring: v })}
          description="Alert when VIP status is about to expire (MAM, AvistaZ network)"
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

        <Toggle
          label="Download Privileges Revoked"
          checked={draft.notifyDownloadDisabled}
          onChange={(v) => updateDraft({ notifyDownloadDisabled: v })}
          description="Alert when an AvistaZ network tracker revokes download access"
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
        <Notice
          variant="info"
          message="Tracker names reveal which private trackers you use. Disable for maximum privacy."
        />
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
      {webhookStatus === "failed" && webhookError && <Notice message={webhookError} />}
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
      <div className="form-responsive-row">
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
      <Notice message={error} />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          text={saving ? "Creating..." : "Create Target"}
        />
        <Button size="sm" variant="ghost" onClick={onCancel} text="Cancel" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// NotificationTargets
// ---------------------------------------------------------------------------

function NotificationTargets() {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)

  const {
    data: targets = [],
    isLoading: loading,
    error: loadError,
  } = useQuery({
    queryKey: ["notification-targets"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/notifications", { signal })
      if (!res.ok) throw new Error("Failed to load notification targets")
      return res.json() as Promise<NotificationTarget[]>
    },
  })

  const handleSaved = useCallback(
    (id: number, updated: NotificationTarget) => {
      queryClient.setQueryData<NotificationTarget[]>(["notification-targets"], (prev) =>
        prev?.map((t) => (t.id === id ? updated : t))
      )
    },
    [queryClient]
  )

  const handleRemove = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" })
      if (!res.ok) return
      queryClient.setQueryData<NotificationTarget[]>(["notification-targets"], (prev) =>
        prev?.filter((t) => t.id !== id)
      )
    },
    [queryClient]
  )

  if (loading) {
    return <CardListSkeleton count={2} />
  }

  if (loadError) {
    return (
      <Notice
        message={
          loadError instanceof Error ? loadError.message : "Failed to load notification targets"
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <H2 className="flex items-center gap-2">
        Webhooks
        <InfoTip
          content="Get alerts when something happens on your trackers."
          docs={DOCS.WEBHOOKS}
        />
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
                queryClient.invalidateQueries({ queryKey: ["notification-targets"] })
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
