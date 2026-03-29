// src/components/ui/ConfirmRemove.tsx

import { useState } from "react"
import { Button } from "@/components/ui/Button"

interface ConfirmRemoveProps {
  onConfirm: () => void
  label?: string
  confirmLabel?: string
}

function ConfirmRemove({
  onConfirm,
  label = "Remove",
  confirmLabel = "Confirm Remove",
}: ConfirmRemoveProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="danger" onClick={onConfirm} text={confirmLabel} />
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} text="Cancel" />
      </div>
    )
  }

  return (
    <Button size="sm" variant="danger" onClick={() => setConfirming(true)} text={label} />
  )
}

export type { ConfirmRemoveProps }
export { ConfirmRemove }
