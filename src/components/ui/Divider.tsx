// src/components/ui/Divider.tsx

import clsx from "clsx"

interface DividerProps {
  /** Removes horizontal margin for use inside cards/sheets */
  compact?: boolean
  className?: string
}

function Divider({ compact, className }: DividerProps) {
  return (
    <div className={clsx("h-1.5 nm-inset-sm rounded-nm-pill", !compact && "mx-8", className)} />
  )
}

export { Divider }
