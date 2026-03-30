// src/components/ui/ConfirmDialog.tsx

"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Disables all actions while processing */
  busy?: boolean
  children?: ReactNode
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  busy,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      busy={busy}
      ariaLabel="Confirm action"
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy} text={cancelLabel} />
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
            text={confirmLabel}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm font-sans text-secondary">{message}</div>
        {children}
      </div>
    </Dialog>
  )
}

export type { ConfirmDialogProps }
export { ConfirmDialog }
