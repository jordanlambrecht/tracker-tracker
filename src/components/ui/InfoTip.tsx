// src/components/ui/InfoTip.tsx

import { cva, type VariantProps } from "class-variance-authority"
import type { ReactNode } from "react"
import { InfoIcon, QuestionIcon } from "@/components/ui/Icons"
import { Tooltip } from "@/components/ui/Tooltip"
import type { DocsEntry } from "@/lib/constants"

const infoTipVariants = cva(
  "inline-flex items-center text-muted hover:text-secondary cursor-help transition-colors duration-150",
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
      <span className={infoTipVariants({ size, className })}>
        <Icon />
      </span>
    </Tooltip>
  )
}

export type { InfoTipProps, InfoTipIcon }
export { InfoTip, infoTipVariants }
