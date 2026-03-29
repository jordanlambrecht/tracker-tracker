// src/components/ui/Card.tsx
import { H2 } from "@typography"
import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { CSSProperties, HTMLAttributes } from "react"
import { hexToRgba } from "@/lib/formatters"

type CardElevation = "raised" | "elevated"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation
  glow?: boolean
  glowColor?: string
  trackerColor?: string
  title?: string
  lazy?: boolean
}

const card = cva("p-5", {
  variants: {
    elevation: {
      raised: "bg-raised nm-raised",
      elevated: "bg-elevated nm-raised-lg",
    },
  },
  defaultVariants: {
    elevation: "raised",
  },
})

function Card({
  elevation = "raised",
  glow = false,
  glowColor,
  trackerColor,
  title,
  lazy,
  className,
  style,
  children,
  ...props
}: CardProps) {
  const glowStyle: CSSProperties = {}

  if (trackerColor) {
    glowStyle.filter = `drop-shadow(0 0 16px ${hexToRgba(trackerColor, 0.15)})`
  } else if (glow && glowColor) {
    glowStyle.filter = `drop-shadow(0 0 16px ${glowColor})`
  }

  return (
    <div
      className={clsx(card({ elevation }), "rounded-nm-lg", lazy && "lazy-card", className)}
      style={{ ...glowStyle, ...style }}
      {...props}
    >
      {title && <H2 className="card-heading">{title}</H2>}
      {children}
    </div>
  )
}

export type { CardElevation, CardProps }
export { Card }
