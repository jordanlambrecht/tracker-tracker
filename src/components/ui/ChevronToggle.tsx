// src/components/ui/ChevronToggle.tsx

interface ChevronToggleProps {
  expanded: boolean
  variant?: "pivot" | "flip"
  className?: string
}

function ChevronToggle({ expanded, variant = "pivot", className }: ChevronToggleProps) {
  if (variant === "flip") {
    return (
      <span
        className={`inline-block transition-transform duration-150 text-tertiary text-sm flex-shrink-0 ${className ?? ""}`}
        style={{ transform: expanded ? "rotate(0deg)" : "rotate(180deg)" }}
      >
        ▾
      </span>
    )
  }

  return (
    <span
      className={`inline-block transition-transform duration-150 text-[10px] ${className ?? ""}`}
      style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      ▶
    </span>
  )
}

export { ChevronToggle }
export type { ChevronToggleProps }
