// src/components/charts/lib/LogScaleToggle.tsx
"use client"

import { ActivityIcon } from "@/components/ui/Icons"
import { Tooltip } from "@/components/ui/Tooltip"

interface LogScaleToggleProps {
  effectiveLog: boolean
  isAuto: boolean
  onToggle: () => void
}

function LogScaleToggle({ effectiveLog, isAuto, onToggle }: LogScaleToggleProps) {
  return (
    <Tooltip
      content={
        isAuto
          ? "Scale: auto-detected. Click to override."
          : "Scale: manual override. Click to reset to auto."
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className="timestamp nm-interactive-sm bg-raised px-2.5 py-1 hover:text-secondary cursor-pointer flex items-center gap-2 rounded-nm-sm"
      >
        <ActivityIcon width="10" height="10" />
        {effectiveLog ? "Log" : "Linear"}
        {isAuto && <span className="opacity-50">auto</span>}
      </button>
    </Tooltip>
  )
}

export type { LogScaleToggleProps }
export { LogScaleToggle }
