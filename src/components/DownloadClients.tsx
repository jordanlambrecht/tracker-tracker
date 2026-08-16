// src/components/DownloadClients.tsx
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { H2, H3, Paragraph, Subheader, Subtext } from "@typography"
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
  NumberInput,
  SaveDiscardBar,
  Select,
  Toggle,
  UptimeBar,
} from "@/components/ui"

import { useActionStatus } from "@/hooks/useActionStatus"
import { useCrudCard } from "@/hooks/useCrudCard"
// Imported from the module rather than the barrel: the barrel pulls in
// credentials.ts, which is "server-only".
import type { AuthMethod } from "@/lib/download-clients/types"
import { formatTimeAgo } from "@/lib/formatters"
import { PORT_MAX, PORT_MIN } from "@/lib/limits"
import { clientQueryOptions } from "@/lib/query-options"
import type { SafeDownloadClient } from "@/types/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientType = "qbittorrent" | "deluge" | "transmission" | "rtorrent"
type DownloadClient = SafeDownloadClient

const EMPTY_TRACKERS: string[] = []

const BLANK_CREDENTIALS_HINT =
  'Leave both blank if qBittorrent has "Bypass authentication for clients on localhost" enabled. ' +
  "qBittorrent must see the connection as coming from loopback, so this does not apply through a " +
  "container, port forward, or reverse proxy."

const API_KEY_HINT =
  "Generate one in qBittorrent under Options → Web UI → API keys. Requires qBittorrent 5.2.0 " +
  "or newer."

const AUTH_METHOD_OPTIONS: { value: AuthMethod; label: string }[] = [
  { value: "password", label: "Username & Password" },
  { value: "apikey", label: "API Key" },
]

/**
 * Auth-method picker plus whichever credential fields that method needs.
 * Shared by the add form and the per-client credential panel so the two cannot
 * drift — they already disagree on state names, which is enough difference.
 */
function CredentialFields({
  authMethod,
  onAuthMethodChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  apiKey,
  onApiKeyChange,
}: {
  authMethod: AuthMethod
  onAuthMethodChange: (value: AuthMethod) => void
  username: string
  onUsernameChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  apiKey: string
  onApiKeyChange: (value: string) => void
}) {
  return (
    <>
      <div className="w-full sm:w-64">
        <Select
          label="Auth Method"
          value={authMethod}
          onChange={(v) => onAuthMethodChange(v as AuthMethod)}
          ariaLabel="Authentication method"
          size="md"
          options={AUTH_METHOD_OPTIONS}
        />
      </div>
      {authMethod === "password" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                label="Username"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="admin"
                name="client-username"
                autoComplete="off"
                data-1p-ignore
              />
            </div>
            <div className="flex-1">
              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="••••••••"
                name="client-password"
                autoComplete="off"
                data-1p-ignore
              />
            </div>
          </div>
          <Subtext>{BLANK_CREDENTIALS_HINT}</Subtext>
        </>
      ) : (
        <>
          <Input
            type="password"
            label="API Key"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="••••••••"
            name="client-api-key"
            autoComplete="off"
            data-1p-ignore
          />
          <Subtext>{API_KEY_HINT}</Subtext>
        </>
      )}
    </>
  )
}

const CLIENT_TYPE_OPTIONS: { value: ClientType; label: string; disabled?: boolean }[] = [
  { value: "qbittorrent", label: "qBittorrent" },
  { value: "deluge", label: "Deluge (coming soon)", disabled: true },
  { value: "transmission", label: "Transmission (coming soon)", disabled: true },
  { value: "rtorrent", label: "rTorrent (coming soon)", disabled: true },
]

// ---------------------------------------------------------------------------
// ClientCard
// ---------------------------------------------------------------------------

interface ClientCardProps {
  client: DownloadClient
  linkedTrackers: string[]
  onSaved: (id: number, updated: DownloadClient) => void
  onRemove: (id: number) => void
  onSetDefault: (id: number) => void
}

/** Fields tracked for dirty detection (excludes transient fields like lastPolledAt). */
const DRAFT_KEYS: (keyof DownloadClient)[] = [
  "name",
  "type",
  "enabled",
  "host",
  "port",
  "useSsl",
  "pollIntervalSeconds",
  "crossSeedTags",
]

function buildPatch(draft: DownloadClient, saved: DownloadClient): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  for (const key of DRAFT_KEYS) {
    const a = draft[key]
    const b = saved[key]
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) patch[key] = a
    } else if (a !== b) patch[key] = a
  }
  return Object.keys(patch).length > 0 ? patch : null
}

function ClientCard({ client, linkedTrackers, onSaved, onRemove, onSetDefault }: ClientCardProps) {
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
  } = useCrudCard({
    item: client,
    apiEndpoint: "/api/clients",
    buildPatch,
    onSaved,
  })
  const {
    status: connectionStatus,
    error: connectionError,
    execute: executeTest,
  } = useActionStatus()
  const [tagInput, setTagInput] = useState("")

  // Credential change state — show inputs for new clients (no creds yet) or after "Change"
  const [changingCredentials, setChangingCredentials] = useState(!client.hasCredentials)
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    client.authMethod === "apikey" ? "apikey" : "password"
  )
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newApiKey, setNewApiKey] = useState("")
  const [credError, setCredError] = useState<string | null>(null)

  // A blank username/password is a valid localhost-bypass setup, so only the
  // API-key mode has anything to require.
  const canSaveCredentials = authMethod === "password" || newApiKey.trim().length > 0

  const { data: uptimeData = null } = useQuery({
    queryKey: ["client-uptime", client.id],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/clients/${client.id}/uptime`, { signal })
      if (!res.ok) return null
      return res.json() as Promise<{
        buckets: { bucketTs: string; ok: number; fail: number }[]
        uptimePercent: number | null
      }>
    },
    refetchInterval: 5 * 60 * 1000,
  })

  const handleTestConnection = () =>
    executeTest(async () => {
      const res = await fetch(`/api/clients/${client.id}/test`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Connection failed")
      }
    })

  async function handleSaveCredentials() {
    if (!canSaveCredentials) return
    setCredError(null)
    try {
      // The mode always travels with its secret — the route rejects one
      // without the other so a switch can never re-label an old credential.
      const body =
        authMethod === "apikey"
          ? { authMethod, apiKey: newApiKey }
          : { authMethod, username: newUsername, password: newPassword }
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCredError(data.error || "Failed to save credentials")
        return
      }
      onSaved(client.id, { ...client, authMethod, hasCredentials: true })
      setChangingCredentials(false)
      setNewUsername("")
      setNewPassword("")
      setNewApiKey("")
    } catch {
      setCredError("Network error — could not save credentials")
    }
  }

  const statusBadge = client.enabled ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="default">Disabled</Badge>
  )

  return (
    <CollapsibleCard
      expanded={expanded}
      onToggle={toggleExpand}
      header={
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <H3 className="truncate">{client.name || "Untitled Client"}</H3>
            {statusBadge}
            {client.isDefault && <Badge variant="accent">Default</Badge>}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xs font-mono text-tertiary">
              {client.lastPolledAt
                ? `Last seen: ${formatTimeAgo(client.lastPolledAt)}`
                : "Last seen: Never"}
            </span>
            {client.errorSince && (
              <span className="text-3xs font-mono text-danger">
                Down since {formatTimeAgo(client.errorSince)}
              </span>
            )}
            {client.lastError && !client.errorSince && (
              <span className="text-3xs font-mono text-danger">{client.lastError}</span>
            )}
          </div>
        </div>
      }
      trailing={CLIENT_TYPE_OPTIONS.find((o) => o.value === client.type)?.label}
      subheader={
        uptimeData ? (
          <div className="px-5 pb-3">
            <UptimeBar buckets={uptimeData.buckets} uptimePercent={uptimeData.uptimePercent} />
          </div>
        ) : undefined
      }
    >
      {/* Row 1: Name + Type + Enabled */}
      <div className="form-responsive-row pt-5">
        <div className="flex-1">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="My qBittorrent"
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            label="Type"
            value={draft.type}
            onChange={(v) => updateDraft({ type: v as ClientType })}
            ariaLabel="Client type"
            size="md"
            options={CLIENT_TYPE_OPTIONS}
          />
        </div>
      </div>

      <Toggle
        label="Enabled"
        checked={draft.enabled}
        onChange={(v) => updateDraft({ enabled: v })}
        description="Disabled clients are not polled and their stats are excluded from dashboard totals."
      />

      <div className="border-t border-border" />

      {/* Row 2: Host + Port + SSL */}
      <div className="form-responsive-row">
        <div className="flex-1">
          <Input
            label="Host"
            value={draft.host}
            onChange={(e) => updateDraft({ host: e.target.value })}
            placeholder="localhost or 192.168.1.100"
          />
        </div>
        <NumberInput
          label="Port"
          value={draft.port}
          onChange={(v) => updateDraft({ port: v })}
          min={PORT_MIN}
          max={PORT_MAX}
        />
      </div>

      <Toggle
        label="Use SSL"
        checked={draft.useSsl}
        onChange={(v) => updateDraft({ useSsl: v })}
        description={`Connect via ${draft.useSsl ? "https" : "http"}://${draft.host}:${draft.port}`}
      />

      {draft.useSsl && draft.port === 80 && (
        <Notice
          variant="warn"
          message="SSL is enabled but port is 80 (standard HTTP). Did you mean port 443?"
        />
      )}
      {!draft.useSsl && draft.port === 443 && (
        <Notice
          variant="warn"
          message="Port 443 is typically used with SSL. Did you mean to enable SSL?"
        />
      )}

      <div className="border-t border-border" />

      {/* Row 3: Auth */}
      <div className="flex flex-col gap-2">
        <H2 className="uppercase tracking-wider">Credentials</H2>
        {changingCredentials ? (
          <div className="flex flex-col gap-3">
            <CredentialFields
              authMethod={authMethod}
              onAuthMethodChange={setAuthMethod}
              username={newUsername}
              onUsernameChange={setNewUsername}
              password={newPassword}
              onPasswordChange={setNewPassword}
              apiKey={newApiKey}
              onApiKeyChange={setNewApiKey}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSaveCredentials}
                disabled={!canSaveCredentials}
                text="Save Credentials"
              />
              {client.hasCredentials && (
                <button
                  type="button"
                  onClick={() => {
                    setChangingCredentials(false)
                    setAuthMethod(client.authMethod === "apikey" ? "apikey" : "password")
                    setNewUsername("")
                    setNewPassword("")
                    setNewApiKey("")
                    setCredError(null)
                  }}
                  className="ghost-link"
                >
                  Cancel
                </button>
              )}
            </div>
            <Notice message={credError} />
          </div>
        ) : (
          <MaskedSecret onChangeClick={() => setChangingCredentials(true)} />
        )}
      </div>

      <div className="border-t border-border" />

      {/* Row 4: Polling */}
      <div className="flex items-end gap-4">
        <div className="w-48">
          <Select
            label="Poll Frequency"
            value={String(draft.pollIntervalSeconds)}
            onChange={(v) => updateDraft({ pollIntervalSeconds: parseInt(v, 10) })}
            ariaLabel="Polling frequency"
            size="md"
            options={[
              { value: "60", label: "Every minute" },
              { value: "120", label: "Every 2 minutes" },
              { value: "300", label: "Every 5 minutes" },
              { value: "600", label: "Every 10 minutes" },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Cross-seed tags */}
      <div className="flex flex-col gap-3">
        <H3>Cross-Seed Tags</H3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="i.e cross-seed"
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault()
                    const tag = tagInput.trim().replace(/,/g, "")
                    if (tag && !draft.crossSeedTags.includes(tag)) {
                      updateDraft({ crossSeedTags: [...draft.crossSeedTags, tag] })
                    }
                    setTagInput("")
                  }
                }}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!tagInput.trim()}
              onClick={() => {
                const tag = tagInput.trim()
                if (tag && !draft.crossSeedTags.includes(tag)) {
                  updateDraft({ crossSeedTags: [...draft.crossSeedTags, tag] })
                }
                setTagInput("")
              }}
              text="Add"
            />
          </div>
          {draft.crossSeedTags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {draft.crossSeedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 font-mono text-xs text-primary bg-control-bg nm-inset-sm px-2.5 py-1 rounded-nm-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        crossSeedTags: draft.crossSeedTags.filter((t) => t !== tag),
                      })
                    }
                    className="text-tertiary hover:text-danger transition-colors cursor-pointer text-xs leading-none"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <Subtext>
          Torrents with these tags are counted as cross-seeded and tracked separately from direct
          seeding stats on the dashboard.
        </Subtext>
      </div>

      {/* Linked trackers */}
      {linkedTrackers.length > 0 && (
        <div className="flex items-center gap-2">
          <Subheader className="uppercase tracking-wider shrink-0">Linked Trackers</Subheader>
          <div className="flex gap-2 flex-wrap">
            {linkedTrackers.map((name) => (
              <Badge key={name} variant="default">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Subtext>
        Trackers are linked to this client via their qBittorrent Tag field in individual tracker
        settings.
      </Subtext>

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
          onClick={handleTestConnection}
          disabled={connectionStatus === "pending"}
        >
          {connectionStatus === "pending"
            ? "Testing..."
            : connectionStatus === "success"
              ? "Connected"
              : connectionStatus === "failed"
                ? "Failed — Retry"
                : "Test Connection"}
        </Button>

        {connectionStatus === "success" && <Badge variant="success">Connection OK</Badge>}
        {connectionStatus === "failed" && <Badge variant="danger">Failed</Badge>}

        <div className="flex-1" />

        {!client.isDefault && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSetDefault(client.id)}
            text="Set as Default"
          />
        )}

        <ConfirmRemove onConfirm={() => onRemove(client.id)} />
      </div>
      {connectionStatus === "failed" && connectionError && <Notice message={connectionError} />}
    </CollapsibleCard>
  )
}

// ---------------------------------------------------------------------------
// DownloadClients
// ---------------------------------------------------------------------------

function AddClientForm({
  onCreated,
  onCancel,
  isFirst,
}: {
  onCreated: () => void
  onCancel: () => void
  isFirst: boolean
}) {
  const [name, setName] = useState("New Client")
  const [host, setHost] = useState("localhost")
  const [port, setPort] = useState(8080)
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Username/password are intentionally not required — qBittorrent accepts
  // blank ones when localhost auth bypass is on. An API key has no such
  // fallback, so it is the one credential the form insists on. Mirrors
  // POST /api/clients.
  const canSubmit =
    name.trim() && host.trim() && (authMethod === "password" || apiKey.trim().length > 0)

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const credentials =
        authMethod === "apikey"
          ? { authMethod, apiKey: apiKey.trim() }
          : { authMethod, username: username.trim(), password }
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          host: host.trim(),
          port,
          ...credentials,
          isDefault: isFirst,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to create client")
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
      <H3>Add Download Client</H3>
      <div className="form-responsive-row">
        <div className="flex-1">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My qBittorrent"
          />
        </div>
        <div className="flex flex-row gap-4 items-end">
          <div className="flex-1 sm:flex-none sm:w-40">
            <Input
              label="Host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="localhost"
            />
          </div>
          <NumberInput label="Port" value={port} onChange={setPort} min={PORT_MIN} max={PORT_MAX} />
        </div>
      </div>
      <CredentialFields
        authMethod={authMethod}
        onAuthMethodChange={setAuthMethod}
        username={username}
        onUsernameChange={setUsername}
        password={password}
        onPasswordChange={setPassword}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
      />
      <Notice message={error} />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          text={saving ? "Creating..." : "Create Client"}
        />
        <Button size="sm" variant="ghost" onClick={onCancel} text="Cancel" />
      </div>
    </Card>
  )
}

function DownloadClients() {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: clients = [], isLoading: loading } = useQuery({
    ...clientQueryOptions,
  })

  const handleSaved = useCallback(
    (id: number, updated: DownloadClient) => {
      queryClient.setQueryData<DownloadClient[]>(clientQueryOptions.queryKey, (prev) =>
        prev?.map((c) => (c.id === id ? updated : c))
      )
    },
    [queryClient]
  )

  const handleRemove = useCallback(
    async (id: number) => {
      await fetch(`/api/clients/${id}`, { method: "DELETE" })
      queryClient.setQueryData<DownloadClient[]>(clientQueryOptions.queryKey, (prev) => {
        if (!prev) return prev
        const next = prev.filter((c) => c.id !== id)
        if (next.length > 0 && !next.some((c) => c.isDefault)) {
          next[0] = { ...next[0], isDefault: true }
        }
        return next
      })
    },
    [queryClient]
  )

  const handleSetDefault = useCallback(
    (id: number) => {
      queryClient.setQueryData<DownloadClient[]>(clientQueryOptions.queryKey, (prev) =>
        prev?.map((c) => ({ ...c, isDefault: c.id === id }))
      )
      fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      }).catch(() => {})
    },
    [queryClient]
  )

  if (loading) {
    return <CardListSkeleton count={2} />
  }

  return (
    <div className="flex flex-col gap-6">
      {clients.length === 0 && !showAddForm ? (
        <Card elevation="raised" className="flex flex-col items-center gap-4 py-10">
          <span className="text-2xl" aria-hidden="true">
            📡
          </span>
          <div className="text-center flex flex-col gap-2">
            <H3>No download clients configured</H3>
            <Paragraph>
              Add a download client to track seeding stats, active torrents, and per-tracker
              download activity.
            </Paragraph>
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)} text="Add Download Client" />
        </Card>
      ) : (
        <>
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              linkedTrackers={EMPTY_TRACKERS}
              onSaved={handleSaved}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
            />
          ))}
          {showAddForm ? (
            <AddClientForm
              isFirst={clients.length === 0}
              onCreated={() => {
                setShowAddForm(false)
                queryClient.invalidateQueries({ queryKey: clientQueryOptions.queryKey })
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() => setShowAddForm(true)}
              text="+ Add Client"
            />
          )}
        </>
      )}
    </div>
  )
}

export { DownloadClients }
