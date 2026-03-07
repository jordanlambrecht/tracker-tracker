// src/components/ui/Card.tsx
import type { HTMLAttributes } from "react"

type CardElevation = "raised" | "elevated"
type CardGlowColor = "accent" | "warn" | "danger" | "success"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation
  glow?: boolean
  glowColor?: CardGlowColor
}

const elevationClasses: Record<CardElevation, string> = {
  raised: "bg-raised",
  elevated: "bg-elevated",
}

const glowClasses: Record<CardGlowColor, string> = {
  accent: "shadow-glow",
  warn: "shadow-glow-warn",
  danger: "shadow-glow-danger",
  success: "shadow-glow-success",
}

function Card({
  elevation = "raised",
  glow = false,
  glowColor = "accent",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-lg border border-border p-4",
        elevationClasses[elevation],
        glow ? glowClasses[glowColor] : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card }
export type { CardProps, CardElevation, CardGlowColor }
