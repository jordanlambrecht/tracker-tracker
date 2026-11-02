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
  /** Disables every button while another action on the same row runs */
  disabled?: boolean
}

function ConfirmRemove({
  onConfirm,
  label = "Remove",
  confirmLabel = "Confirm Remove",
  variant = "danger",
  className,
  busy,
  busyLabel,
  disabled,
}: ConfirmRemoveProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="danger"
          onClick={onConfirm}
          disabled={busy || disabled}
          text={busy && busyLabel ? busyLabel : confirmLabel}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={busy || disabled}
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
      disabled={disabled}
      text={label}
    />
  )
}

export type { ConfirmRemoveProps }
export { ConfirmRemove }
