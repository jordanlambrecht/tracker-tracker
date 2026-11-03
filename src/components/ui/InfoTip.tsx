// src/components/ui/InfoTip.tsx

"use client"

import { InfoIcon, QuestionIcon } from "@icons"
import { cva, type VariantProps } from "class-variance-authority"
import type { ReactNode } from "react"
import type { DocsEntry } from "@/lib/constants"
import { Tooltip } from "./Tooltip"

const infoTipVariants = cva(
  "inline-flex items-center text-muted hover:text-secondary cursor-help transition-colors duration-150 bg-transparent border-0 p-0 outline-none focus-visible:text-secondary",
  {
    variants: {
      size: {
        sm: "[&>svg]:w-3 [&>svg]:h-3",
        md: "[&>svg]:w-3.5 [&>svg]:h-3.5",
        lg: "[&>svg]:w-4 [&>svg]:h-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

type InfoTipIcon = "info" | "question"

interface InfoTipProps extends VariantProps<typeof infoTipVariants> {
  content: ReactNode
  icon?: InfoTipIcon
  docs?: DocsEntry
  className?: string
}

const iconMap: Record<InfoTipIcon, typeof InfoIcon> = {
  info: InfoIcon,
  question: QuestionIcon,
}

function InfoTip({ content, docs, icon = "info", size, className }: InfoTipProps) {
  const Icon = iconMap[icon]
  const href = docs?.href

  return (
    <Tooltip content={content} docs={docs}>
      {/* Tab cannot reach the tip's own link, which sits in a portal, so the icon opens it too. */}
      <button
        type="button"
        className={infoTipVariants({ size, className })}
        aria-label={href ? "More info, opens documentation" : "More info"}
        onClick={href ? () => window.open(href, "_blank", "noopener,noreferrer") : undefined}
      >
        <Icon />
      </button>
    </Tooltip>
  )
}

export type { InfoTipIcon, InfoTipProps }
export { InfoTip, infoTipVariants }
