// src/components/ui/ConfirmRemove.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"

interface ConfirmRemoveProps {
  onConfirm: () => void
  label?: string
  confirmLabel?: string
  variant?: "danger" | "ghost"
  className?: string
  /** Disables buttons and shows busyLabel while processing */
  busy?: boolean
  busyLabel?: string
}

function ConfirmRemove({
  onConfirm,
  label = "Remove",
  confirmLabel = "Confirm Remove",
  variant = "danger",
  className,
  busy,
  busyLabel,
}: ConfirmRemoveProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="danger"
          onClick={onConfirm}
          disabled={busy}
          text={busy && busyLabel ? busyLabel : confirmLabel}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={busy}
          text="Cancel"
        />
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant={variant}
      className={className}
      onClick={() => setConfirming(true)}
      text={label}
    />
  )
}

export type { ConfirmRemoveProps }
export { ConfirmRemove }
