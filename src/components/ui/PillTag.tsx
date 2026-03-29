// src/components/ui/PillTag.tsx

import clsx from "clsx"
import type { HTMLAttributes } from "react"

type PillTagColor = "accent" | "danger" | "secondary" | "tertiary" | "muted"
type PillTagSize = "sm" | "md"

const COLOR_MAP: Record<PillTagColor, string> = {
  accent: "text-accent",
  danger: "text-danger",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  muted: "text-muted",
}

const SIZE_MAP: Record<PillTagSize, string> = {
  sm: "px-1.5 py-0.5 text-3xs",
  md: "px-3 py-1 text-xs",
}

interface PillTagProps extends HTMLAttributes<HTMLSpanElement> {
  color?: PillTagColor
  size?: PillTagSize
  label?: string
}

function PillTag({
  color = "tertiary",
  size = "md",
  label,
  className,
  children,
  ...props
}: PillTagProps) {
  return (
    <span
      className={clsx(
        "nm-inset-sm bg-control-bg rounded-nm-pill font-mono",
        SIZE_MAP[size],
        COLOR_MAP[color],
        className
      )}
      {...props}
    >
      {label ?? children}
    </span>
  )
}

export { PillTag }
export type { PillTagColor, PillTagProps }
