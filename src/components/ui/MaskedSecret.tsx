// src/components/ui/MaskedSecret.tsx
"use client"

import { Button } from "@/components/ui/Button"

interface MaskedSecretProps {
  onChangeClick: () => void
  label?: string
}

function MaskedSecret({ onChangeClick, label = "Change" }: MaskedSecretProps) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <span
        className="text-sm font-mono text-tertiary nm-inset bg-control-bg px-4 py-3 flex-1 rounded-nm-md"
      >
        ••••••••••••••••
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onChangeClick}>
        {label}
      </Button>
    </div>
  )
}

export type { MaskedSecretProps }
export { MaskedSecret }
