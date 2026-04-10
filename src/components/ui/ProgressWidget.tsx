// src/components/ui/ProgressWidget.tsx

import { SlotLabel } from "@typography"
import clsx from "clsx"
import { ProgressBar } from "@/components/ui/ProgressBar"

interface ProgressWidgetProps {
  label: string
  value: string
  percent: number
  color: string
  footer?: string
  inset?: boolean
  className?: string
}

function ProgressWidget({
  label,
  value,
  percent,
  color,
  footer,
  inset = false,
  className,
}: ProgressWidgetProps) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-2",
        inset && "nm-inset-sm bg-control-bg rounded-nm-md p-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <SlotLabel label={label} />
        <span className="text-xs font-mono text-secondary font-semibold">{value}</span>
      </div>
      <ProgressBar percent={percent} color={color} size="sm" />
      {footer && <p className="timestamp text-right">{footer}</p>}
    </div>
  )
}

export type { ProgressWidgetProps }
export { ProgressWidget }
