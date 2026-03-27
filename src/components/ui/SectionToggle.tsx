// src/components/ui/SectionToggle.tsx

import clsx from "clsx"
import type { ReactNode } from "react"
import { ChevronToggle } from "@/components/ui/ChevronToggle"

interface SectionToggleProps {
  label: ReactNode
  expanded: boolean
  onToggle: () => void
  className?: string
}

function SectionToggle({ label, expanded, onToggle, className }: SectionToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "flex items-center gap-2 text-xs font-sans font-medium text-tertiary uppercase tracking-wider",
        "hover:text-secondary transition-colors duration-150 cursor-pointer w-fit",
        className
      )}
    >
      <ChevronToggle expanded={expanded} />
      {label}
    </button>
  )
}

export { SectionToggle }
export type { SectionToggleProps }
