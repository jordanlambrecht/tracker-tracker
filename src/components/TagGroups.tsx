// src/components/TagGroups.tsx
//
// Functions: TagGroups, AddTagGroupForm, TagGroupCard, MemberRow

"use client"

import clsx from "clsx"
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { EmojiPickerPopover } from "@/components/ui/EmojiPickerPopover"
import { Input } from "@/components/ui/Input"
import { H2, H3, Paragraph } from "@/components/ui/Typography"
import type { TagGroup, TagGroupChartType, TagGroupMember } from "@/types/api"

const CHART_TYPE_OPTIONS: { value: TagGroupChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "donut", label: "Donut" },
  { value: "treemap", label: "Treemap" },
]

// Characters that are problematic in qBT tag names
const TAG_WARN_PATTERN = /[+&#%?]/

function tagWarning(tag: string): string | null {
  if (TAG_WARN_PATTERN.test(tag)) {
    return `Tag contains a special character (${tag.match(TAG_WARN_PATTERN)?.[0]}). qBittorrent may not recognise it.`
  }
  return null
}

// ─── AddTagGroupForm ──────────────────────────────────────────────────────────

interface AddTagGroupFormProps {
  onCreated: () => void
  onCancel: () => void
}

function AddTagGroupForm({ onCreated, onCancel }: AddTagGroupFormProps) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("")
  const [chartType, setChartType] = useState<TagGroupChartType>("bar")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/tag-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, emoji: emoji.trim() || undefined, chartType }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Create failed" }))
        throw new Error((data as { error?: string }).error ?? "Create failed")
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleCreate()
    if (e.key === "Escape") onCancel()
  }

  return (
    <Card elevation="raised" className="flex flex-col gap-4 mb-4">
      <H3>New Tag Group</H3>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
            Emoji
          </span>
          <EmojiPickerPopover
            value={emoji}
            onChange={setEmoji}
            disabled={saving}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Group Name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null) }}
            onKeyDown={handleKeyDown}
            placeholder="i.e Cross-Seed, Tracker Upload"
            disabled={saving}
            error={error ?? undefined}
            autoFocus
          />
        </div>
      </div>

      {/* Chart type selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
          Chart Type
        </span>
        <div className="nm-inset-sm p-1.5 flex gap-1 rounded-nm-md">
          {CHART_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChartType(opt.value)}
              disabled={saving}
              className={clsx(
                "flex-1 px-3 py-1.5 text-xs font-mono transition-all duration-150 cursor-pointer border-none rounded-nm-sm",
                chartType === opt.value
                  ? "nm-raised-sm text-primary font-semibold"
                  : "bg-transparent text-tertiary hover:text-secondary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </div>
    </Card>
  )
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface ExistingMemberRowProps {
  groupId: number
  member: TagGroupMember
  onRemoved: () => void
}

function ExistingMemberRow({ groupId, member, onRemoved }: ExistingMemberRowProps) {
  const [tag, setTag] = useState(member.tag)
  const [label, setLabel] = useState(member.label)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedTag = useRef(member.tag)
  const savedLabel = useRef(member.label)

  async function handleBlur() {
    const trimmedTag = tag.trim()
    const trimmedLabel = label.trim()

    // Nothing changed — skip
    if (trimmedTag === savedTag.current && trimmedLabel === savedLabel.current) return
    if (!trimmedTag || !trimmedLabel) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tag-groups/${groupId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: trimmedTag, label: trimmedLabel }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        throw new Error((data as { error?: string }).error ?? "Save failed")
      }
      savedTag.current = trimmedTag
      savedLabel.current = trimmedLabel
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
      // Revert on error
      setTag(savedTag.current)
      setLabel(savedLabel.current)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tag-groups/${groupId}/members/${member.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }))
        throw new Error((data as { error?: string }).error ?? "Delete failed")
      }
      onRemoved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
      setSaving(false)
    }
  }

  const warn = tagWarning(tag)

  return (
    <div className="flex flex-col gap-1">
      <div
        className="nm-inset-sm flex items-center gap-3 px-3 py-2 bg-control-bg rounded-nm-md"
      >
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-mono text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted disabled:opacity-40"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onBlur={handleBlur}
            placeholder="qbt-tag"
            disabled={saving}
            aria-label="qBT Tag"
          />
        </div>
        <div className="w-px h-4 bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-mono text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted disabled:opacity-40"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            placeholder="Display Label"
            disabled={saving}
            aria-label="Display Label"
          />
        </div>
        {saving && (
          <span className="text-xs font-mono text-tertiary shrink-0">Saving…</span>
        )}
        <button
          type="button"
          onClick={handleRemove}
          disabled={saving}
          className="shrink-0 text-tertiary hover:text-danger transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
          aria-label="Remove member"
        >
          ✕
        </button>
      </div>
      {warn && !error && (
        <p className="text-xs font-sans text-warn px-1">{warn}</p>
      )}
      {error && (
        <p className="text-xs font-sans text-danger px-1" role="alert">{error}</p>
      )}
    </div>
  )
}

// ─── NewMemberRow ─────────────────────────────────────────────────────────────

interface NewMemberRowProps {
  groupId: number
  onAdded: () => void
}

function NewMemberRow({ groupId, onAdded }: NewMemberRowProps) {
  const [tag, setTag] = useState("")
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function tryAdd() {
    const trimmedTag = tag.trim()
    const trimmedLabel = label.trim()
    if (!trimmedTag || !trimmedLabel) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tag-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: trimmedTag, label: trimmedLabel }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Add failed" }))
        throw new Error((data as { error?: string }).error ?? "Add failed")
      }
      setTag("")
      setLabel("")
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") tryAdd()
  }

  const warn = tag ? tagWarning(tag) : null

  return (
    <div className="flex flex-col gap-1">
      <div
        className="nm-inset-sm flex items-center gap-3 px-3 py-2 bg-control-bg border border-dashed border-border rounded-nm-md"
      >
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-mono text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted disabled:opacity-40"
            value={tag}
            onChange={(e) => { setTag(e.target.value); setError(null) }}
            onBlur={tryAdd}
            onKeyDown={handleKeyDown}
            placeholder="qbt-tag"
            disabled={saving}
            aria-label="New qBT Tag"
          />
        </div>
        <div className="w-px h-4 bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-mono text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted disabled:opacity-40"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(null) }}
            onBlur={tryAdd}
            onKeyDown={handleKeyDown}
            placeholder="Display Label"
            disabled={saving}
            aria-label="New Display Label"
          />
        </div>
        {saving && (
          <span className="text-xs font-mono text-tertiary shrink-0">Adding…</span>
        )}
        <span className="shrink-0 w-5 text-base leading-none" aria-hidden="true" />
      </div>
      {warn && !error && (
        <p className="text-xs font-sans text-warn px-1">{warn}</p>
      )}
      {error && (
        <p className="text-xs font-sans text-danger px-1" role="alert">{error}</p>
      )}
    </div>
  )
}

// ─── TagGroupCard ─────────────────────────────────────────────────────────────

interface TagGroupCardProps {
  group: TagGroup
  onUpdated: () => void
}

function TagGroupCard({ group, onUpdated }: TagGroupCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(group.name)
  const savedName = useRef(group.name)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emoji, setEmoji] = useState(group.emoji ?? "")
  const savedEmoji = useRef(group.emoji ?? "")
  const [chartType, setChartType] = useState<TagGroupChartType>(group.chartType)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function patchGroup(patch: Record<string, unknown>) {
    const res = await fetch(`/api/tag-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Save failed" }))
      throw new Error((data as { error?: string }).error ?? "Save failed")
    }
  }

  async function handleChartTypeChange(newType: TagGroupChartType) {
    const prev = chartType
    setChartType(newType)
    try {
      await patchGroup({ chartType: newType })
    } catch {
      setChartType(prev)
    }
  }

  async function handleNameBlur() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(savedName.current)
      setEditingName(false)
      return
    }
    if (trimmed === savedName.current) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    setNameError(null)
    try {
      await patchGroup({ name: trimmed })
      savedName.current = trimmed
      setEditingName(false)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Network error")
      setName(savedName.current)
    } finally {
      setSavingName(false)
    }
  }

  function handleNameKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleNameBlur()
    if (e.key === "Escape") {
      setName(savedName.current)
      setEditingName(false)
      setNameError(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/tag-groups/${group.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }))
        throw new Error((data as { error?: string }).error ?? "Delete failed")
      }
      onUpdated()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Network error")
      setDeleting(false)
    }
  }

  return (
    <Card elevation="raised" className="flex flex-col gap-0 !p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Emoji */}
        {group.emoji && (
          <span className="text-base shrink-0" aria-hidden="true">{group.emoji}</span>
        )}

        {/* Name — editable inline */}
        {editingName ? (
          <input
            className="flex-1 font-sans text-sm font-semibold text-primary bg-control-bg nm-inset-sm px-2 py-1 focus:outline-none min-w-0 rounded-nm-sm"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(null) }}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            disabled={savingName}
            // biome-ignore lint/a11y/noAutofocus: inline rename input must focus immediately for UX
            autoFocus
            aria-label="Group name"
          />
        ) : (
          <button
            type="button"
            className="flex-1 font-sans text-sm font-semibold text-primary hover:text-accent transition-colors duration-150 min-w-0 truncate text-left bg-transparent border-none p-0 cursor-pointer"
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {name}
          </button>
        )}

        {savingName && (
          <span className="text-xs font-mono text-tertiary shrink-0">Saving…</span>
        )}

        <span className="text-xs font-mono text-tertiary shrink-0 select-none">
          {group.members.length} {group.members.length === 1 ? "tag" : "tags"}
        </span>

        {/* Collapse toggle */}
        <button
          type="button"
          className="shrink-0 text-tertiary hover:text-primary transition-colors duration-150 bg-transparent border-none p-0 cursor-pointer text-xs leading-none"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronToggle expanded={expanded} variant="flip" />
        </button>
      </div>

      {nameError && (
        <p className="text-xs font-sans text-danger px-5 pb-2" role="alert">{nameError}</p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
          <div className="border-t border-border mb-1" />

          {/* Emoji + chart type row */}
          <div className="flex items-end gap-4 mb-1">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
                Emoji
              </span>
              <EmojiPickerPopover
                value={emoji}
                onChange={(e) => {
                  setEmoji(e)
                  // Auto-save on pick
                  const trimmed = e.trim()
                  if (trimmed !== savedEmoji.current) {
                    patchGroup({ emoji: trimmed || null }).then(() => {
                      savedEmoji.current = trimmed
                    }).catch(() => {
                      setEmoji(savedEmoji.current)
                    })
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
                Chart Type
              </span>
              <div className="nm-inset-sm p-1.5 flex gap-1 rounded-nm-md">
                {CHART_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChartTypeChange(opt.value)}
                    className={clsx(
                      "flex-1 px-3 py-1.5 text-xs font-mono transition-all duration-150 cursor-pointer border-none rounded-nm-sm",
                      chartType === opt.value
                        ? "nm-raised-sm text-primary font-semibold"
                        : "bg-transparent text-tertiary hover:text-secondary"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-3">
            <span className="flex-1 text-xs font-sans font-medium text-secondary uppercase tracking-wider">
              qBT Tag
            </span>
            <div className="w-px h-3" />
            <span className="flex-1 text-xs font-sans font-medium text-secondary uppercase tracking-wider">
              Display Label
            </span>
            <span className="w-5" aria-hidden="true" />
          </div>

          {/* Existing members */}
          {group.members.map((member) => (
            <ExistingMemberRow
              key={member.id}
              groupId={group.id}
              member={member}
              onRemoved={onUpdated}
            />
          ))}

          {/* Add new member row */}
          <NewMemberRow groupId={group.id} onAdded={onUpdated} />

          <div className="border-t border-border mt-1" />

          {/* Delete group */}
          <div className="flex items-center justify-between gap-3">
            {deleteError && (
              <p className="text-xs font-sans text-danger" role="alert">{deleteError}</p>
            )}
            {!deleteError && <span />}

            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-sans text-warn">Delete this group?</span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-danger hover:text-danger"
              >
                Delete Group
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── TagGroups ────────────────────────────────────────────────────────────────

function TagGroups() {
  const [groups, setGroups] = useState<TagGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/tag-groups")
      if (!res.ok) throw new Error("Failed to load tag groups")
      const data: TagGroup[] = await res.json()
      setGroups(data)
    } catch {
      // Non-critical — list just won't populate
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  function handleCreated() {
    setShowAddForm(false)
    fetchGroups()
  }

  function handleUpdated() {
    fetchGroups()
  }

  return (
    <section aria-labelledby="tag-groups-heading">
      <div className="flex items-center justify-between mb-2">
        <H2 id="tag-groups-heading">Tag Groups</H2>
        {!showAddForm && (
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(true)}>
            + New Group
          </Button>
        )}
      </div>

      <Paragraph className="mb-6">
        Bundle qBittorrent tags into named groups for breakdown charts on each tracker&apos;s Torrents tab.
      </Paragraph>

      {showAddForm && (
        <AddTagGroupForm
          onCreated={handleCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <p className="text-sm font-mono text-tertiary py-4">Loading…</p>
      ) : groups.length === 0 && !showAddForm ? (
        <p className="text-sm font-mono text-muted py-8 text-center">No tag groups yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <TagGroupCard key={group.id} group={group} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </section>
  )
}

export { TagGroups }
