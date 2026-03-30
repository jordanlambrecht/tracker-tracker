// src/components/ui/FilterPill.tsx

import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type FilterPillSize = "sm" | "md"
type FilterPillInactive = "transparent" | "inset" | "strikethrough"

interface FilterPillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  active: boolean
  text?: string
  children?: ReactNode
  size?: FilterPillSize
  activeColor?: string
  inactive?: FilterPillInactive
}

const pill = cva(
  "font-mono transition-colors duration-150 cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "px-2 py-0.5 text-2xs rounded-nm-sm",
        md: "px-2.5 py-1 text-xs rounded-nm-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

const INACTIVE_STYLES: Record<FilterPillInactive, string> = {
  transparent: "bg-transparent text-muted hover:text-secondary",
  inset: "nm-inset-sm text-tertiary hover:text-secondary",
  strikethrough: "bg-transparent text-muted hover:text-secondary line-through opacity-50",
}

function FilterPill({
  active,
  text,
  children,
  size = "md",
  activeColor = "text-primary",
  inactive = "transparent",
  className,
  ...props
}: FilterPillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={clsx(
        pill({ size }),
        active ? clsx("nm-raised-sm font-semibold", activeColor) : INACTIVE_STYLES[inactive],
        className
      )}
      {...props}
    >
      {children ?? text}
    </button>
  )
}

export type { FilterPillInactive, FilterPillProps, FilterPillSize }
export { FilterPill }
