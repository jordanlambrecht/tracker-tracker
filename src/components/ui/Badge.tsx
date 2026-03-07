// src/components/ui/Badge.tsx
import type { HTMLAttributes } from "react"

type BadgeVariant = "default" | "accent" | "warn" | "danger" | "success"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-raised text-secondary border-border",
  accent: "bg-accent-dim text-accent border-accent",
  warn: "bg-warn-dim text-warn border-warn",
  danger: "bg-danger-dim text-danger border-danger",
  success: "bg-success-dim text-success border-success",
}

function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5",
        "font-mono text-xs font-medium",
        "rounded-full border",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant }
