// src/components/ui/SaveDiscardBar.tsx

import clsx from "clsx"
import { Button } from "@/components/ui/Button"

interface SaveDiscardBarProps {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard?: () => void
  error?: string | null
  success?: string | null
  saveLabel?: string
  savingLabel?: string
  className?: string
  justify?: "start" | "end"
  showDivider?: boolean
  saveDisabled?: boolean
}

function SaveDiscardBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  error,
  success,
  saveLabel = "Save Changes",
  savingLabel = "Saving...",
  className,
  justify = "start",
  showDivider = true,
  saveDisabled = false,
}: SaveDiscardBarProps) {
  if (!dirty && !error && !success) return null

  const content = (
    <>
      {error && (
        <p className="text-xs font-sans text-danger" role="alert">
          {error}
        </p>
      )}
      {success && <p className="text-xs font-sans text-success">{success}</p>}
      {dirty && (
        <>
          {showDivider && <div className="border-t border-border" />}
          <div className={clsx("flex items-center gap-3", justify === "end" && "justify-end")}>
            <Button size="sm" onClick={onSave} disabled={saving || saveDisabled}>
              {saving ? savingLabel : saveLabel}
            </Button>
            {onDiscard && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDiscard}
                disabled={saving}
                text="Discard"
              />
            )}
          </div>
        </>
      )}
    </>
  )

  return className ? <div className={className}>{content}</div> : content
}

export type { SaveDiscardBarProps }
export { SaveDiscardBar }
