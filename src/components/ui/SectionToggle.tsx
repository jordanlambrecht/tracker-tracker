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

/**
 * The standard disclosure pattern: the heading carries the document outline, the
 * button carries the control. Collapsing the two — rendering a bare <button> — is
 * how the primary dashboard sections lost their H2s, leaving the page with an H1
 * and a set of orphaned subordinate headings under no parent.
 *
 * The <h2> is deliberately unstyled: every visual class stays on the button, so
 * this is layout-neutral. Tailwind preflight zeroes heading margins, no call site
 * passes `className`, and all parents are `flex flex-col`, where a block-level
 * wrapper around a `w-fit` button renders identically.
 */
function SectionToggle({ label, expanded, onToggle, className }: SectionToggleProps) {
  return (
    <h2>
      <button
        type="button"
        aria-expanded={expanded}
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
    </h2>
  )
}

export type { SectionToggleProps }
export { SectionToggle }
