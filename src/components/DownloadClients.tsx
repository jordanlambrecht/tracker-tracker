// src/components/DownloadClients.tsx
//
// Functions: DownloadClients, ClientCard

"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { Input } from "@/components/ui/Input"
import { MaskedSecret } from "@/components/ui/MaskedSecret"
import { NumberInput } from "@/components/ui/NumberInput"
import { Select } from "@/components/ui/Select"
import { Toggle } from "@/components/ui/Toggle"
import { H3, Paragraph, Subheader, Subtext } from "@/components/ui/Typography"
import { UptimeBar } from "@/components/ui/UptimeBar"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientType = "qbittorrent" | "deluge" | "transmission" | "rtorrent"

interface DownloadClient {
  id: number
  name: string
  type: ClientType
  enabled: boolean
  host: string
  port: number
  useSsl: boolean
  hasCredentials: boolean
  pollIntervalSeconds: number
  isDefault: boolean
  crossSeedTags: string[]
  lastPolledAt: string | null
  lastError: string | null
}

type ConnectionStatus = "idle" | "testing" | "success" | "failed"

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
  onUpdate: (id: number, patch: Partial<DownloadClient>) => void
  onRemove: (id: number) => void
  onSetDefault: (id: number) => void
}

function ClientCard({ client, linkedTrackers, onUpdate, onRemove, onSetDefault }: ClientCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle")
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [tagInput, setTagInput] = useState("")

  // Credential change state — show inputs for new clients (no creds yet) or after "Change"
  const [changingCredentials, setChangingCredentials] = useState(!client.hasCredentials)
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [credError, setCredError] = useState<string | null>(null)

  const [uptimeData, setUptimeData] = useState<{
    buckets: { bucketTs: string; ok: number; fail: number }[]
    uptimePercent: number | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchUptime() {
      try {
        const res = await fetch(`/api/clients/${client.id}/uptime`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setUptimeData(data)
      } catch {
        // uptime bar is non-critical
      }
    }
    fetchUptime()
    const interval = setInterval(fetchUptime, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [client.id])

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("testing")
    setConnectionError(null)
    try {
      const res = await fetch(`/api/clients/${client.id}/test`, { method: "POST" })
      if (res.ok) {
        setConnectionStatus("success")
        setTimeout(() => setConnectionStatus("idle"), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        setConnectionError(data.error || "Connection failed")
        setConnectionStatus("failed")
      }
    } catch {
      setConnectionError("Network error — could not reach server")
      setConnectionStatus("failed")
    }
  }, [client.id])

  async function handleSaveCredentials() {
    if (!newUsername.trim() || !newPassword.trim()) return
    setCredError(null)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCredError(data.error || "Failed to save credentials")
        return
      }
      onUpdate(client.id, { hasCredentials: true })
      setChangingCredentials(false)
      setNewUsername("")
      setNewPassword("")
    } catch {
      setCredError("Network error — could not save credentials")
    }
  }

  const statusBadge = client.enabled
    ? <Badge variant="success">Active</Badge>
    : <Badge variant="default">Disabled</Badge>

  return (
    <Card elevation="raised" className="flex flex-col gap-0 !p-0 overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 px-5 py-4 w-full text-left cursor-pointer hover:bg-overlay transition-colors duration-100"
      >
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <H3 className="truncate">{client.name || "Untitled Client"}</H3>
          {statusBadge}
          {client.isDefault && <Badge variant="accent">Default</Badge>}
        </div>
        <span className="text-xs font-mono text-tertiary shrink-0">
          {CLIENT_TYPE_OPTIONS.find((o) => o.value === client.type)?.label}
        </span>
        <ChevronToggle expanded={expanded} variant="flip" className="text-tertiary text-sm" />
      </button>

      {/* Uptime bar — always visible */}
      {uptimeData && (
        <div className="px-5 pb-3">
          <UptimeBar
            buckets={uptimeData.buckets}
            uptimePercent={uptimeData.uptimePercent}
          />
        </div>
      )}

      {/* Body — collapsible */}
      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border">
          {/* Row 1: Name + Type + Enabled */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end pt-5">
            <div className="flex-1">
              <Input
                label="Name"
                value={client.name}
                onChange={(e) => onUpdate(client.id, { name: e.target.value })}
                placeholder="My qBittorrent"
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                label="Type"
                value={client.type}
                onChange={(v) => onUpdate(client.id, { type: v as ClientType })}
                ariaLabel="Client type"
                size="md"
                options={CLIENT_TYPE_OPTIONS}
              />
            </div>
          </div>

          <Toggle
            label="Enabled"
            checked={client.enabled}
            onChange={(v) => onUpdate(client.id, { enabled: v })}
            description="Disabled clients are not polled and their stats are excluded from dashboard totals."
          />

          <div className="border-t border-border" />

          {/* Row 2: Host + Port + SSL */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <Input
                label="Host"
                value={client.host}
                onChange={(e) => onUpdate(client.id, { host: e.target.value })}
                placeholder="localhost or 192.168.1.100"
              />
            </div>
            <NumberInput
              label="Port"
              value={client.port}
              onChange={(v) => onUpdate(client.id, { port: v })}
              min={1}
              max={65535}
            />
          </div>

          <Toggle
            label="Use SSL"
            checked={client.useSsl}
            onChange={(v) => onUpdate(client.id, { useSsl: v })}
            description={`Connect via ${client.useSsl ? "https" : "http"}://${client.host}:${client.port}`}
          />

          {client.useSsl && client.port === 80 && (
            <p className="text-xs font-mono text-warning">
              SSL is enabled but port is 80 (standard HTTP). Did you mean port 443?
            </p>
          )}
          {!client.useSsl && client.port === 443 && (
            <p className="text-xs font-mono text-warning">
              Port 443 is typically used with SSL. Did you mean to enable SSL?
            </p>
          )}

          <div className="border-t border-border" />

          {/* Row 3: Auth */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
              Credentials
            </span>
            {changingCredentials ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      label="Username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
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
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      name="client-password"
                      autoComplete="off"
                      data-1p-ignore
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSaveCredentials}
                    disabled={!newUsername.trim() || !newPassword.trim()}
                  >
                    Save Credentials
                  </Button>
                  {client.hasCredentials && (
                    <button
                      type="button"
                      onClick={() => {
                        setChangingCredentials(false)
                        setNewUsername("")
                        setNewPassword("")
                        setCredError(null)
                      }}
                      className="text-xs font-mono text-tertiary hover:text-secondary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {credError && (
                  <p className="text-xs font-mono text-danger">{credError}</p>
                )}
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
                value={String(client.pollIntervalSeconds)}
                onChange={(v) => onUpdate(client.id, { pollIntervalSeconds: parseInt(v, 10) })}
                ariaLabel="Polling frequency"
                size="md"
                options={[
                  { value: "10", label: "Every 10 seconds" },
                  { value: "30", label: "Every 30 seconds" },
                  { value: "60", label: "Every minute" },
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
                        if (tag && !client.crossSeedTags.includes(tag)) {
                          onUpdate(client.id, { crossSeedTags: [...client.crossSeedTags, tag] })
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
                    if (tag && !client.crossSeedTags.includes(tag)) {
                      onUpdate(client.id, { crossSeedTags: [...client.crossSeedTags, tag] })
                    }
                    setTagInput("")
                  }}
                >
                  Add
                </Button>
              </div>
              {client.crossSeedTags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {client.crossSeedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-primary bg-control-bg nm-inset-sm px-2.5 py-1 rounded-nm-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => onUpdate(client.id, {
                          crossSeedTags: client.crossSeedTags.filter((t) => t !== tag),
                        })}
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
              Torrents with these tags are counted as cross-seeded and tracked
              separately from direct seeding stats on the dashboard.
            </Subtext>
          </div>

          {/* Linked trackers */}
          {linkedTrackers.length > 0 && (
            <div className="flex items-center gap-2">
              <Subheader className="uppercase tracking-wider shrink-0">
                Linked Trackers
              </Subheader>
              <div className="flex gap-1.5 flex-wrap">
                {linkedTrackers.map((name) => (
                  <Badge key={name} variant="default">{name}</Badge>
                ))}
              </div>
            </div>
          )}

          <Subtext>
            Trackers are linked to this client via their qBittorrent Tag field in
            individual tracker settings.
          </Subtext>

          <div className="border-t border-border" />

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleTestConnection}
              disabled={connectionStatus === "testing"}
            >
              {connectionStatus === "testing"
                ? "Testing..."
                : connectionStatus === "success"
                  ? "Connected"
                  : connectionStatus === "failed"
                    ? "Failed — Retry"
                    : "Test Connection"}
            </Button>

            {connectionStatus === "success" && (
              <Badge variant="success">Connection OK</Badge>
            )}
            {connectionStatus === "failed" && (
              <Badge variant="danger">Failed</Badge>
            )}

            <div className="flex-1" />

            {!client.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSetDefault(client.id)}
              >
                Set as Default
              </Button>
            )}

            {confirmRemove ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRemove(client.id)}
                >
                  Confirm Remove
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRemove(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </Button>
            )}
          </div>
          {connectionStatus === "failed" && connectionError && (
            <p className="text-xs font-mono text-danger">{connectionError}</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// DownloadClients
// ---------------------------------------------------------------------------

function AddClientForm({ onCreated, onCancel, isFirst }: {
  onCreated: () => void
  onCancel: () => void
  isFirst: boolean
}) {
  const [name, setName] = useState("New Client")
  const [host, setHost] = useState("localhost")
  const [port, setPort] = useState(8080)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSubmit = name.trim() && host.trim() && username.trim() && password.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          host: host.trim(),
          port,
          username: username.trim(),
          password,
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
    <Card elevation="raised" className="flex flex-col gap-4 !p-5">
      <H3>Add Download Client</H3>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
        <div className="flex-1">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My qBittorrent" />
        </div>
        <div className="flex flex-row gap-4 items-end">
          <div className="flex-1 sm:flex-none sm:w-40">
            <Input label="Host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
          </div>
          <NumberInput label="Port" value={port} onChange={setPort} min={1} max={65535} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" name="client-username" autoComplete="off" data-1p-ignore />
        </div>
        <div className="flex-1">
          <Input type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" name="client-password" autoComplete="off" data-1p-ignore />
        </div>
      </div>
      {error && <p className="text-sm font-mono text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? "Creating..." : "Create Client"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}

function DownloadClients() {
  const [clients, setClients] = useState<DownloadClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients")
      if (!res.ok) return
      const data: DownloadClient[] = await res.json()
      setClients(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleUpdate = useCallback((id: number, patch: Partial<DownloadClient>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }, [])

  const handleRemove = useCallback(async (id: number) => {
    await fetch(`/api/clients/${id}`, { method: "DELETE" })
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id)
      // If we removed the default, promote the first remaining client optimistically
      if (next.length > 0 && !next.some((c) => c.isDefault)) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })
  }, [])

  const handleSetDefault = useCallback((id: number) => {
    setClients((prev) =>
      prev.map((c) => ({ ...c, isDefault: c.id === id }))
    )
    fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    }).catch(() => {})
  }, [])

  if (loading) {
    return <p className="text-sm font-mono text-tertiary">Loading clients...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {clients.length === 0 && !showAddForm ? (
        <Card elevation="raised" className="flex flex-col items-center gap-4 py-10">
          <span className="text-2xl" aria-hidden="true">📡</span>
          <div className="text-center flex flex-col gap-2">
            <H3>No download clients configured</H3>
            <Paragraph>
              Add a download client to track seeding stats, active torrents, and
              per-tracker download activity.
            </Paragraph>
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            Add Download Client
          </Button>
        </Card>
      ) : (
        <>
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              linkedTrackers={[]}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
            />
          ))}
          {showAddForm ? (
            <AddClientForm
              isFirst={clients.length === 0}
              onCreated={() => {
                setShowAddForm(false)
                fetchClients()
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() => setShowAddForm(true)}
            >
              + Add Client
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export { DownloadClients }
