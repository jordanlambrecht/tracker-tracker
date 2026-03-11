// src/components/ui/ChevronToggle.tsx

import { clsx } from "clsx"

interface ChevronToggleProps {
  expanded: boolean
  variant?: "pivot" | "flip"
  className?: string
}

function ChevronToggle({ expanded, variant = "pivot", className }: ChevronToggleProps) {
  if (variant === "flip") {
    return (
      <span
        className={clsx(
          "inline-block transition-transform duration-150 text-tertiary text-sm shrink-0",
          expanded ? "rotate-0" : "rotate-180",
          className
        )}
      >
        ▾
      </span>
    )
  }

  return (
    <span
      className={clsx(
        "inline-block transition-transform duration-150 text-[10px]",
        expanded ? "rotate-90" : "rotate-0",
        className
      )}
    >
      ▶
    </span>
  )
}

export { ChevronToggle }
export type { ChevronToggleProps }
