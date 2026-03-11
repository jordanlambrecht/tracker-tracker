// src/components/ui/ConfirmButton.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"

interface ConfirmButtonProps {
  onConfirm: () => void
  label?: string
  confirmLabel?: string
  variant?: "danger" | "ghost"
  size?: "sm" | "md"
  disabled?: boolean
  className?: string
}

function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm",
  variant = "danger",
  size = "sm",
  disabled = false,
  className,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={() => {
            onConfirm()
            setConfirming(false)
          }}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={() => setConfirming(true)}
      className={className}
    >
      {label}
    </Button>
  )
}

export { ConfirmButton }
export type { ConfirmButtonProps }
