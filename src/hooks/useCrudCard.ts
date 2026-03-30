// src/hooks/useCrudCard.ts

import { type Dispatch, type SetStateAction, useEffect, useState } from "react"

interface UseCrudCardOptions<T extends { id: number }> {
  item: T
  apiEndpoint: string
  buildPatch: (draft: T, original: T) => Record<string, unknown> | null
  onSaved: (id: number, updated: T) => void
}

interface UseCrudCardReturn<T> {
  draft: T
  setDraft: Dispatch<SetStateAction<T>>
  updateDraft: (patch: Partial<T>) => void
  dirty: boolean
  saving: boolean
  saveError: string | null
  expanded: boolean
  toggleExpand: () => void
  handleSave: () => Promise<void>
  handleDiscard: () => void
}

function useCrudCard<T extends { id: number }>({
  item,
  apiEndpoint,
  buildPatch,
  onSaved,
}: UseCrudCardOptions<T>): UseCrudCardReturn<T> {
  const [draft, setDraft] = useState<T>(item)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const dirty = buildPatch(draft, item) !== null

  // Sync draft when parent pushes new server state (and user isn't editing)
  useEffect(() => {
    if (!dirty) setDraft(item)
  }, [item, dirty])

  function updateDraft(patch: Partial<T>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  async function handleSave() {
    const patch = buildPatch(draft, item)
    if (!patch) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`${apiEndpoint}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaveError((data as { error?: string }).error ?? "Failed to save")
        return
      }
      onSaved(item.id, draft)
    } catch {
      setSaveError("Network error")
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setDraft(item)
    setSaveError(null)
  }

  function toggleExpand() {
    setExpanded((e) => !e)
  }

  return {
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
  }
}

export type { UseCrudCardOptions, UseCrudCardReturn }
export { useCrudCard }
