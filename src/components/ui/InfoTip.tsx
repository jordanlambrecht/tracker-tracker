// src/components/ui/InfoTip.tsx

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

  return (
    <Tooltip content={content} docs={docs}>
      <button type="button" className={infoTipVariants({ size, className })} aria-label="More info">
        <Icon />
      </button>
    </Tooltip>
  )
}

export type { InfoTipIcon, InfoTipProps }
export { InfoTip, infoTipVariants }
