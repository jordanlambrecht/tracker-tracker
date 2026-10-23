// src/components/settings/ProwlarrSection.tsx
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { H2, H3, Paragraph, Subtext } from "@typography"
import { useCallback, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardListSkeleton,
  CollapsibleCard,
  ConfirmRemove,
  Input,
  MaskedSecret,
  Notice,
  SaveDiscardBar,
  Toggle,
} from "@/components/ui"
import { useActionStatus } from "@/hooks/useActionStatus"
import { useCrudCard } from "@/hooks/useCrudCard"
import { formatTimeAgo } from "@/lib/formatters"
import { prowlarrQueryOptions } from "@/lib/query-options"
import type { SafeProwlarrInstance } from "@/types/api"

const API_KEY_HINT = "Found in Prowlarr under Settings → General → Security. Stored encrypted."

const DRAFT_KEYS = ["name", "url", "enabled"] as const

function buildPatch(
  draft: SafeProwlarrInstance,
  saved: SafeProwlarrInstance
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  for (const key of DRAFT_KEYS) {
    if (draft[key] !== saved[key]) patch[key] = draft[key]
  }
  return Object.keys(patch).length > 0 ? patch : null
}

function InstanceCard({
  instance,
  onSaved,
  onRemove,
}: {
  instance: SafeProwlarrInstance
  onSaved: (id: number, updated: SafeProwlarrInstance) => void
  onRemove: (id: number) => void
}) {
  const {
    draft,
    updateDraft,
    dirty,
    saving,
    saveError,
    expanded,
    toggleExpand,
    handleSave,
    handleDiscard,
  } = useCrudCard({ item: instance, apiEndpoint: "/api/prowlarr", buildPatch, onSaved })
  const { status: testStatus, error: testError, execute: executeTest } = useActionStatus()
  const [testedVersion, setTestedVersion] = useState<string | null>(null)
  const [changingKey, setChangingKey] = useState(!instance.hasApiKey)
  const [newKey, setNewKey] = useState("")
  const [keyError, setKeyError] = useState<string | null>(null)

  const handleTest = () =>
    executeTest(async () => {
      const res = await fetch(`/api/prowlarr/${instance.id}/test`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Connection failed")
      setTestedVersion(typeof data.version === "string" ? data.version : null)
    })

  async function handleSaveKey() {
    if (!newKey.trim()) return
    setKeyError(null)
    try {
      const res = await fetch(`/api/prowlarr/${instance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: newKey.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setKeyError(data.error || "Failed to save API key")
        return
      }
      onSaved(instance.id, { ...instance, hasApiKey: true, lastError: null, errorSince: null })
      setChangingKey(false)
      setNewKey("")
    } catch {
      setKeyError("Network error. Could not save API key")
    }
  }

  const healthProblems = instance.healthIssues.filter(
    (h) => h.type === "error" || h.type === "warning"
  )

  return (
    <CollapsibleCard
      expanded={expanded}
      onToggle={toggleExpand}
      header={
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <H3 className="truncate">{instance.name}</H3>
            {instance.enabled ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="default">Disabled</Badge>
            )}
            {healthProblems.length > 0 && !instance.lastError && (
              <Badge variant="warn">
                {healthProblems.length} health {healthProblems.length === 1 ? "issue" : "issues"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xs font-mono text-tertiary">
              {instance.lastPolledAt
                ? `Last checked: ${formatTimeAgo(instance.lastPolledAt)}`
                : "Last checked: Never"}
              {` · ${instance.indexerCount} indexers`}
              {instance.version ? ` · v${instance.version}` : ""}
            </span>
            {instance.lastError && (
              <span className="text-3xs font-mono text-danger">
                Unreachable
                {instance.errorSince ? ` since ${formatTimeAgo(instance.errorSince)}` : ""}:{" "}
                {instance.lastError}
              </span>
            )}
          </div>
        </div>
      }
      trailing="Prowlarr"
    >
      <div className="form-responsive-row pt-5">
        <div className="flex-1">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            name="prowlarr-name"
            autoComplete="off"
            data-1p-ignore
          />
        </div>
      </div>
      <Input
        type="url"
        label="URL"
        value={draft.url}
        onChange={(e) => updateDraft({ url: e.target.value })}
        name="prowlarr-url"
        autoComplete="off"
        data-1p-ignore
      />

      <Toggle
        label="Enabled"
        checked={draft.enabled}
        onChange={(v) => updateDraft({ enabled: v })}
      />

      <div className="border-t border-border" />

      <div className="flex flex-col gap-2">
        <H2 className="uppercase tracking-wider">API Key</H2>
        {changingKey ? (
          <div className="flex flex-col gap-3">
            <Input
              type="password"
              label="API Key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="••••••••"
              name="prowlarr-api-key"
              autoComplete="off"
              data-1p-ignore
            />
            <Subtext>{API_KEY_HINT}</Subtext>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveKey}
                disabled={!newKey.trim()}
                text="Save API Key"
              />
              {instance.hasApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setChangingKey(false)
                    setNewKey("")
                    setKeyError(null)
                  }}
                  className="ghost-link"
                >
                  Cancel
                </button>
              )}
            </div>
            <Notice message={keyError} />
          </div>
        ) : (
          <MaskedSecret onChangeClick={() => setChangingKey(true)} />
        )}
      </div>

      {instance.healthIssues.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-2">
            <H2 className="uppercase tracking-wider">Prowlarr Health</H2>
            {instance.healthIssues.map((issue) => (
              <Notice
                key={`${issue.source}-${issue.message}`}
                variant={issue.type === "error" ? "danger" : "warn"}
                message={issue.message}
              />
            ))}
          </div>
        </>
      )}

      <SaveDiscardBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        error={saveError}
      />

      <div className="border-t border-border" />

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleTest}
          disabled={testStatus === "pending"}
          text={
            testStatus === "pending"
              ? "Testing..."
              : testStatus === "failed"
                ? "Failed. Retry"
                : "Test Connection"
          }
        />
        {testStatus === "success" && (
          <Badge variant="success">
            Connected{testedVersion ? ` (Prowlarr ${testedVersion})` : ""}
          </Badge>
        )}
        <div className="flex-1" />
        <ConfirmRemove onConfirm={() => onRemove(instance.id)} />
      </div>
      {testStatus === "failed" && testError && <Notice message={testError} />}
    </CollapsibleCard>
  )
}

function AddInstanceForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("Prowlarr")
  const [url, setUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canSubmit = name.trim() && url.trim() && apiKey.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/prowlarr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), apiKey: apiKey.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to add Prowlarr")
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
      <H3>Add Prowlarr</H3>
      {/* The API key is a password field, so without these a password manager
          fills a saved username into the field before it. */}
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        name="prowlarr-name"
        autoComplete="off"
        data-1p-ignore
      />
      <Input
        type="url"
        label="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="http://localhost:9696"
        name="prowlarr-url"
        autoComplete="off"
        data-1p-ignore
      />
      <Input
        type="password"
        label="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="••••••••"
        name="prowlarr-api-key"
        autoComplete="off"
        data-1p-ignore
      />
      <Subtext>{API_KEY_HINT}</Subtext>
      <Notice message={error} />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          text={saving ? "Adding..." : "Add Prowlarr"}
        />
        <Button size="sm" variant="ghost" onClick={onCancel} text="Cancel" />
      </div>
    </Card>
  )
}

function ProwlarrSection() {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const { data: instances = [], isLoading } = useQuery({
    ...prowlarrQueryOptions,
    // A new instance's first poll lands a few seconds after it is added.
    refetchInterval: 30_000,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: prowlarrQueryOptions.queryKey })
    // Tracker status and indexer pickers read the same instances.
    queryClient.invalidateQueries({ queryKey: ["trackers"] })
    queryClient.invalidateQueries({ queryKey: ["prowlarr-indexers"] })
  }, [queryClient])

  const handleSaved = useCallback(
    (id: number, updated: SafeProwlarrInstance) => {
      queryClient.setQueryData<SafeProwlarrInstance[]>(prowlarrQueryOptions.queryKey, (prev) =>
        prev?.map((i) => (i.id === id ? updated : i))
      )
      refresh()
    },
    [queryClient, refresh]
  )

  const handleRemove = useCallback(
    async (id: number) => {
      await fetch(`/api/prowlarr/${id}`, { method: "DELETE" })
      queryClient.setQueryData<SafeProwlarrInstance[]>(prowlarrQueryOptions.queryKey, (prev) =>
        prev?.filter((i) => i.id !== id)
      )
      refresh()
    },
    [queryClient, refresh]
  )

  if (isLoading) return <CardListSkeleton count={1} />

  return (
    <section aria-labelledby="prowlarr-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <H2 id="prowlarr-heading">Prowlarr</H2>
        <Paragraph>
          Indexers are matched to trackers by hostname, or pinned in each tracker&apos;s settings.
        </Paragraph>
      </div>
      {instances.map((instance) => (
        <InstanceCard
          key={instance.id}
          instance={instance}
          onSaved={handleSaved}
          onRemove={handleRemove}
        />
      ))}
      {showAddForm ? (
        <AddInstanceForm
          onCreated={() => {
            setShowAddForm(false)
            refresh()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => setShowAddForm(true)}
          text="+ Add Prowlarr"
        />
      )}
    </section>
  )
}

export { ProwlarrSection }
