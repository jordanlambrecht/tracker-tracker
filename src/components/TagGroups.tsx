// src/components/TagGroups.tsx
//
// Functions: TagGroups, AddTagGroupForm, TagGroupCard, SortableMemberRow, MemberRow, NewMemberRow

"use client"

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { H2, H3, Paragraph } from "@typography"
import { type KeyboardEvent, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { CollapsibleCard } from "@/components/ui/CollapsibleCard"
import { EmojiPickerPopover } from "@/components/ui/EmojiPickerPopover"
import { FilterPill } from "@/components/ui/FilterPill"
import { Input } from "@/components/ui/Input"
import { QBT_TAG_WARN_PATTERN } from "@/components/ui/QbtTagWarning"
import { Toggle } from "@/components/ui/Toggle"
import { Tooltip } from "@/components/ui/Tooltip"
import { DOCS } from "@/lib/constants"
import type { TagGroup, TagGroupChartType } from "@/types/api"

const CHART_TYPE_OPTIONS: { value: TagGroupChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "donut", label: "Donut" },
  { value: "treemap", label: "Treemap" },
  { value: "numbers", label: "Numbers" },
]

function tagWarning(tag: string): string | null {
  if (QBT_TAG_WARN_PATTERN.test(tag)) {
    return `Tag contains a special character (${tag.match(QBT_TAG_WARN_PATTERN)?.[0]}). qBittorrent may not recognise it.`
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
          <H2 className="uppercase tracking-wider">
            Emoji
          </H2>
          <EmojiPickerPopover value={emoji} onChange={setEmoji} disabled={saving} />
        </div>
        <div className="flex-1">
          <Input
            label="Group Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="i.e Cross-Seed, Tracker Upload"
            disabled={saving}
            error={error ?? undefined}
            autoFocus
          />
        </div>
      </div>

      {/* Chart type selector */}
      <div className="flex flex-col gap-2">
        <H2 className="uppercase tracking-wider">
          Display Type
        </H2>
        <div className="nm-inset-sm p-1.5 flex gap-1 rounded-nm-md">
          {CHART_TYPE_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              active={chartType === opt.value}
              onClick={() => setChartType(opt.value)}
              disabled={saving}
              text={opt.label}
              className="flex-1"
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving} text="Cancel" />
        <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim()} text={saving ? "Creating…" : "Create"} />
      </div>
    </Card>
  )
}

// ─── MemberRow (presentational) ───────────────────────────────────────────────

interface MemberRowProps {
  tag: string
  label: string
  onTagChange: (v: string) => void
  onLabelChange: (v: string) => void
  onRemove: () => void
  disabled?: boolean
  dragHandle?: boolean
  isNew?: boolean
}

function MemberRow({
  tag,
  label,
  onTagChange,
  onLabelChange,
  onRemove,
  disabled,
  dragHandle,
  isNew,
}: MemberRowProps) {
  const warn = tag ? tagWarning(tag) : null
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`nm-inset-sm flex items-center gap-3 px-3 py-2 bg-control-bg rounded-nm-md${isNew ? " border border-dashed border-border" : ""}`}
      >
        {(dragHandle || isNew) && (
          <span
            className={`shrink-0 text-sm leading-none select-none${isNew ? " text-transparent" : " text-tertiary cursor-grab active:cursor-grabbing"}`}
            aria-hidden="true"
          >
            ⠿
          </span>
        )}
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-mono text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted disabled:opacity-40"
            value={tag}
            onChange={(e) => onTagChange(e.target.value)}
            placeholder="qbt-tag"
            disabled={disabled}
            aria-label={isNew ? "New qBT Tag" : "qBT Tag"}
          />
        </div>
        <div className="w-px h-4 bg-border shrink-0" />
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-mono text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted disabled:opacity-40"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Display Label"
            disabled={disabled}
            aria-label={isNew ? "New Display Label" : "Display Label"}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 text-tertiary hover:text-danger transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
          aria-label="Remove member"
        >
          ✕
        </button>
      </div>
      {warn && <p className="text-xs font-sans text-warn px-1">{warn}</p>}
    </div>
  )
}

// ─── SortableMemberRow ────────────────────────────────────────────────────────

interface SortableMemberRowProps extends Omit<MemberRowProps, "dragHandle"> {
  sortId: string
}

function SortableMemberRow({ sortId, ...props }: SortableMemberRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sortId })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MemberRow {...props} dragHandle />
    </div>
  )
}

// ─── TagGroupCard ─────────────────────────────────────────────────────────────

interface EditableMember {
  id: number | null
  tag: string
  label: string
}

interface TagGroupCardProps {
  group: TagGroup
  onUpdated: () => void
}

function TagGroupCard({ group, onUpdated }: TagGroupCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(group.name)
  const [emoji, setEmoji] = useState(group.emoji ?? "")
  const [chartType, setChartType] = useState<TagGroupChartType>(group.chartType)
  const [countUnmatched, setCountUnmatched] = useState(group.countUnmatched)
  const [members, setMembers] = useState<EditableMember[]>(
    group.members.map((m) => ({ id: m.id, tag: m.tag, label: m.label }))
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sync from parent when group prop changes (e.g. after save + refetch)
  useEffect(() => {
    setName(group.name)
    setEmoji(group.emoji ?? "")
    setChartType(group.chartType)
    setCountUnmatched(group.countUnmatched)
    setMembers(group.members.map((m) => ({ id: m.id, tag: m.tag, label: m.label })))
  }, [group])

  // Dirty detection
  const isDirty = (() => {
    if (name.trim() !== group.name) return true
    if ((emoji.trim() || null) !== (group.emoji || null)) return true
    if (chartType !== group.chartType) return true
    if (countUnmatched !== group.countUnmatched) return true
    if (members.length !== group.members.length) return true
    for (let i = 0; i < members.length; i++) {
      const m = members[i]
      const orig = group.members[i]
      if (!orig || m.id !== orig.id || m.tag !== orig.tag || m.label !== orig.label) return true
    }
    return false
  })()

  function handleAddRow() {
    setMembers((prev) => [...prev, { id: null, tag: "", label: "" }])
  }

  function handleRemoveMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setMembers((prev) => {
      const oldIndex = prev.findIndex((_, i) => sortKey(prev[i], i) === active.id)
      const newIndex = prev.findIndex((_, i) => sortKey(prev[i], i) === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) return

    setSaving(true)
    setSaveError(null)
    try {
      await fetch(`/api/tag-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          emoji: emoji.trim() || null,
          chartType,
          countUnmatched,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to save group")
      })

      const currentIds = new Set(members.filter((m) => m.id !== null).map((m) => m.id))
      const removedMembers = group.members.filter((m) => !currentIds.has(m.id))
      for (const rm of removedMembers) {
        await fetch(`/api/tag-groups/${group.id}/members/${rm.id}`, { method: "DELETE" })
      }

      for (let i = 0; i < members.length; i++) {
        const m = members[i]
        if (m.id === null) continue
        const orig = group.members.find((om) => om.id === m.id)
        const origIndex = group.members.findIndex((om) => om.id === m.id)
        if (orig && (m.tag !== orig.tag || m.label !== orig.label || i !== origIndex)) {
          await fetch(`/api/tag-groups/${group.id}/members/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tag: m.tag.trim(), label: m.label.trim(), sortOrder: i }),
          })
        }
      }

      for (let i = 0; i < members.length; i++) {
        const m = members[i]
        if (m.id !== null) continue
        if (!m.tag.trim() || !m.label.trim()) continue
        await fetch(`/api/tag-groups/${group.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag: m.tag.trim(), label: m.label.trim(), sortOrder: i }),
        })
      }

      onUpdated()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setName(group.name)
    setEmoji(group.emoji ?? "")
    setChartType(group.chartType)
    setCountUnmatched(group.countUnmatched)
    setMembers(group.members.map((m) => ({ id: m.id, tag: m.tag, label: m.label })))
    setSaveError(null)
  }

  function handleNameKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") setEditingName(false)
    if (e.key === "Escape") {
      setName(group.name)
      setEditingName(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/tag-groups/${group.id}`, { method: "DELETE" })
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

  const sortIds = members.map((m, i) => sortKey(m, i))
  const savedSortIds = sortIds.filter((_, i) => members[i].id !== null)

  return (
    <CollapsibleCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      header={
        <>
          {emoji && (
            <span className="text-base shrink-0" aria-hidden="true">
              {emoji}
            </span>
          )}

          {editingName ? (
            <input
              className="flex-1 font-sans text-sm font-semibold text-primary bg-control-bg nm-inset-sm px-2 py-1 focus:outline-none min-w-0 rounded-nm-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={saving}
              // biome-ignore lint/a11y/noAutofocus: inline rename input must focus immediately for UX
              autoFocus
              aria-label="Group name"
            />
          ) : (
            <Tooltip content="Double-click to rename">
              {/* biome-ignore lint/a11y/noStaticElementInteractions: double-click to rename is a progressive enhancement */}
              <span
                className="flex-1 font-sans text-sm font-semibold text-primary min-w-0 truncate text-left"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditingName(true)
                }}
              >
                {name}
              </span>
            </Tooltip>
          )}

          {isDirty && (
            <Tooltip content="Unsaved changes">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            </Tooltip>
          )}

          <span className="text-xs font-mono text-tertiary shrink-0">
            {members.length} {members.length === 1 ? "tag" : "tags"}
          </span>
        </>
      }
    >
      <div className="border-t border-border mb-1" />

      {/* Emoji + display type row */}
      <div className="flex items-end gap-4 mb-1">
        <div className="flex flex-col gap-1">
          <H2 className="uppercase tracking-wider">
            Emoji
          </H2>
          <EmojiPickerPopover value={emoji} onChange={setEmoji} />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <H2 className="uppercase tracking-wider">
            Display Type
          </H2>
          <div className="nm-inset-sm p-1.5 flex gap-1 rounded-nm-md">
            {CHART_TYPE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.value}
                active={chartType === opt.value}
                onClick={() => setChartType(opt.value)}
                text={opt.label}
                className="flex-1"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Count unmatched toggle */}
      <Toggle
        label="Count unmatched tags"
        checked={countUnmatched}
        onChange={setCountUnmatched}
        description="Include a count of torrents that don't match any tag in this group."
      />

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3">
        <span className="shrink-0 text-sm leading-none w-4" aria-hidden="true" />
        <H2 className="flex-1 uppercase tracking-wider">
          qBT Tag
        </H2>
        <div className="w-px h-3" />
        <H2 className="flex-1 uppercase tracking-wider">
          Display Label
        </H2>
        <span className="w-4" aria-hidden="true" />
      </div>

      {/* Sortable saved members + unsaved new rows */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={savedSortIds} strategy={verticalListSortingStrategy}>
          {members.map((m, i) =>
            m.id !== null ? (
              <SortableMemberRow
                key={sortIds[i]}
                sortId={sortIds[i]}
                tag={m.tag}
                label={m.label}
                onTagChange={(v) =>
                  setMembers((prev) => prev.map((p, j) => (j === i ? { ...p, tag: v } : p)))
                }
                onLabelChange={(v) =>
                  setMembers((prev) => prev.map((p, j) => (j === i ? { ...p, label: v } : p)))
                }
                onRemove={() => handleRemoveMember(i)}
                disabled={saving}
              />
            ) : (
              <MemberRow
                key={sortIds[i]}
                tag={m.tag}
                label={m.label}
                onTagChange={(v) =>
                  setMembers((prev) => prev.map((p, j) => (j === i ? { ...p, tag: v } : p)))
                }
                onLabelChange={(v) =>
                  setMembers((prev) => prev.map((p, j) => (j === i ? { ...p, label: v } : p)))
                }
                onRemove={() => handleRemoveMember(i)}
                disabled={saving}
                isNew
              />
            )
          )}
        </SortableContext>
      </DndContext>

      {/* Add row button */}
      <button
        type="button"
        onClick={handleAddRow}
        disabled={saving}
        className="text-xs font-mono text-tertiary hover:text-accent transition-colors duration-150 cursor-pointer bg-transparent border-none p-0 text-left disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Add Row
      </button>

      <div className="border-t border-border mt-1" />

      {/* Footer: Delete + Save */}
      {saveError && (
        <p className="text-xs font-sans text-danger px-1" role="alert">
          {saveError}
        </p>
      )}
      {deleteError && (
        <p className="text-xs font-sans text-danger px-1" role="alert">
          {deleteError}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans text-warn">Delete this group?</span>
              <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting} text={deleting ? "Deleting…" : "Confirm"} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                text="Cancel"
              />
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="text-danger hover:text-danger"
              text="Delete Group"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button size="sm" variant="ghost" onClick={handleDiscard} disabled={saving} text="Discard" />
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty || !name.trim()} text={saving ? "Saving…" : "Save"} />
        </div>
      </div>
    </CollapsibleCard>
  )
}

function sortKey(m: EditableMember, i: number): string {
  return m.id !== null ? `member-${m.id}` : `new-${i}`
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
        <H2 id="tag-groups-heading" className="flex items-center gap-2">
          Tag Groups
          <Tooltip
            content="Create tag groups to visualize your qBittorrent tags as charts."
            docs={DOCS.TAG_GROUPS}
          >
            <span className="text-muted hover:text-secondary cursor-help text-sm">&#9432;</span>
          </Tooltip>
        </H2>
        {!showAddForm && (
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(true)} text="+ New Group" />
        )}
      </div>

      <Paragraph className="mb-6">
        Bundle qBittorrent tags into named groups for breakdown charts on each tracker&apos;s
        Torrents tab.
      </Paragraph>

      {showAddForm && (
        <AddTagGroupForm onCreated={handleCreated} onCancel={() => setShowAddForm(false)} />
      )}

      {loading ? (
        <p className="text-sm font-mono text-tertiary py-4">Loading…</p>
      ) : groups.length === 0 && !showAddForm ? (
        <p className="text-sm font-mono text-muted py-8 text-center">No tag groups yet</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <TagGroupCard key={group.id} group={group} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </section>
  )
}

export { TagGroups }
