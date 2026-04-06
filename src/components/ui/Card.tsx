// src/components/ui/Card.tsx
import { H2 } from "@typography"
import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { CSSProperties, HTMLAttributes } from "react"
import { hexToRgba } from "@/lib/color-utils"

type CardElevation = "raised" | "elevated"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation
  glow?: boolean
  glowColor?: string
  trackerColor?: string
  title?: string
  subtitle?: string
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
  subtitle,
  lazy,
  className,
  style,
  children,
  ...props
}: CardProps) {
  const composedStyle: CSSProperties = {}

  // Outer haze
  if (trackerColor) {
    composedStyle.filter = `drop-shadow(0 0 16px ${hexToRgba(trackerColor, 0.11)})`
  } else if (glow && glowColor) {
    composedStyle.filter = `drop-shadow(0 0 16px ${glowColor})`
  }

  // Inset accent — pseudo-element for the "face"
  if (trackerColor) {
    ;(composedStyle as Record<string, string>)["--card-accent"] = hexToRgba(trackerColor, 0.08)
  }

  return (
    <div
      className={clsx(
        card({ elevation }),
        "rounded-nm-lg",
        lazy && "lazy-card",
        trackerColor && "card-accent",
        className
      )}
      style={{ ...composedStyle, ...style }}
      {...props}
    >
      {(title || subtitle) && (
        <div className="flex flex-col gap-1">
          {title && <H2 className="card-heading">{title}</H2>}
          {subtitle && <p className="text-xs font-mono text-tertiary">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export type { CardElevation, CardProps }
export { Card }
