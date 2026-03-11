// src/components/ui/Badge.tsx

import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { HTMLAttributes } from "react"

type BadgeVariant = "default" | "accent" | "warn" | "danger" | "success"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const badge = cva(
  "inline-flex items-center px-3 py-1 font-mono text-xs font-medium nm-raised-sm",
  {
    variants: {
      variant: {
        default: "bg-elevated text-secondary",
        accent: "bg-accent-dim text-accent",
        warn: "bg-warn-dim text-warn",
        danger: "bg-danger-dim text-danger",
        success: "bg-success-dim text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  variant = "default",
  className,
  style,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={clsx(badge({ variant }), "rounded-nm-pill", className)}
      style={style}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant }
