// src/components/ui/ConfirmAction.tsx

import { cva } from "class-variance-authority"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/Button"

const confirmVariants = cva("nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md", {
  variants: {
    colorScheme: {
      danger: "bg-danger-dim",
      warn: "bg-warn-dim",
    },
  },
  defaultVariants: { colorScheme: "danger" },
})

interface ConfirmActionProps {
  colorScheme?: "danger" | "warn"
  message: ReactNode
  confirmLabel: string
  confirmingLabel?: string
  onConfirm: () => void
  onCancel: () => void
  confirming?: boolean
  confirmDisabled?: boolean
  children?: ReactNode
  additionalActions?: ReactNode
}

function ConfirmAction({
  colorScheme = "danger",
  message,
  confirmLabel,
  confirmingLabel,
  onConfirm,
  onCancel,
  confirming = false,
  confirmDisabled = false,
  children,
  additionalActions,
}: ConfirmActionProps) {
  return (
    <div className={confirmVariants({ colorScheme })}>
      <p className="text-sm font-sans text-primary leading-relaxed">{message}</p>
      {children}
      <div className="flex gap-3">
        <Button
          size="sm"
          variant="danger"
          disabled={confirming || confirmDisabled}
          onClick={onConfirm}
          text={confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
        />
        {additionalActions}
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={confirming} text="Cancel" />
      </div>
    </div>
  )
}

export type { ConfirmActionProps }
export { ConfirmAction }
