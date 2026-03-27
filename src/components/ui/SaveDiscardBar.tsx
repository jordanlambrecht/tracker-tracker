// src/components/ui/SaveDiscardBar.tsx

import { Button } from "@/components/ui/Button"

interface SaveDiscardBarProps {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
  error?: string | null
  saveLabel?: string
  savingLabel?: string
}

function SaveDiscardBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  error,
  saveLabel = "Save Changes",
  savingLabel = "Saving...",
}: SaveDiscardBarProps) {
  if (!dirty) return null

  return (
    <>
      <div className="border-t border-border" />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? savingLabel : saveLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        {error && <span className="text-xs font-mono text-danger">{error}</span>}
      </div>
    </>
  )
}

export { SaveDiscardBar }
export type { SaveDiscardBarProps }
