// src/components/ui/StatusDot.tsx
import { cva } from "class-variance-authority"
import clsx from "clsx"

type StatusDotTone = "accent" | "success" | "warn" | "danger" | "secondary" | "muted"
type StatusDotSize = "sm" | "md"

interface StatusDotProps {
  tone: StatusDotTone
  glow?: boolean
  size?: StatusDotSize
  /** Replaces the tone's colour, glow included. */
  color?: string
  /** Announces the dot. Leave it out when the text beside the dot names the state. */
  label?: string
  className?: string
}

// The glow is a drop shadow in currentColor, so each tone sets the text colour too.
// A still dot is dimmed so it never reads as live.
const statusDot = cva("inline-block rounded-full shrink-0", {
  variants: {
    tone: {
      accent: "bg-accent text-accent",
      success: "bg-success text-success",
      warn: "bg-warn text-warn",
      danger: "bg-danger text-danger",
      secondary: "bg-secondary text-secondary",
      muted: "bg-muted text-muted",
    },
    glow: {
      true: "animate-pulse-glow",
      false: "opacity-50",
    },
    size: {
      sm: "w-2 h-2",
      md: "w-3 h-3",
    },
  },
  defaultVariants: {
    glow: false,
    size: "sm",
  },
})

function StatusDot({ tone, glow = false, size = "sm", color, label, className }: StatusDotProps) {
  const classes = clsx(statusDot({ tone, glow, size }), className)
  const style = color ? { backgroundColor: color, color } : undefined
  if (label) return <output aria-label={label} className={classes} style={style} />
  return <span aria-hidden="true" className={classes} style={style} />
}

export type { StatusDotProps, StatusDotTone }
export { StatusDot }
