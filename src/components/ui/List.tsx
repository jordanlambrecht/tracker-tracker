// src/components/ui/List.tsx
//
// Functions: UL, OL, LI

import clsx from "clsx"
import type { HTMLAttributes, OlHTMLAttributes } from "react"

/** Unordered list — tertiary text, custom bullet markers */
function UL({ className, children, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={clsx("flex flex-col gap-1.5 text-xs font-sans text-tertiary leading-relaxed", className)}
      {...props}
    >
      {children}
    </ul>
  )
}

/** Ordered list — tertiary text, decimal markers in mono */
function OL({ className, children, ...props }: OlHTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className={clsx(
        "flex flex-col gap-1.5 text-xs font-sans text-tertiary leading-relaxed list-decimal pl-4 marker:font-mono marker:text-accent/40",
        className,
      )}
      {...props}
    >
      {children}
    </ol>
  )
}

/**
 * List item with subtle cyan dot marker.
 * Use inside <UL> for bullet lists.
 * Inside <OL>, use plain <li> — the native decimal markers handle numbering.
 */
function LI({ className, children, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={clsx(
        "relative pl-4 before:absolute before:left-0 before:top-[0.45em] before:h-1 before:w-1 before:rounded-full before:bg-accent/40",
        className,
      )}
      {...props}
    >
      {children}
    </li>
  )
}

export { UL, OL, LI }
