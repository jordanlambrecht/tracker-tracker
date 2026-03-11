// src/components/charts/LogScaleToggle.tsx
//
// Functions: LogScaleToggle

"use client"

import { ActivityIcon } from "@/components/ui/Icons"

interface LogScaleToggleProps {
  effectiveLog: boolean
  isAuto: boolean
  onToggle: () => void
}

function LogScaleToggle({ effectiveLog, isAuto, onToggle }: LogScaleToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="nm-raised-sm bg-raised px-2.5 py-1 text-[10px] font-mono text-muted hover:text-secondary active:nm-inset-sm active:scale-[0.97] transition-all duration-150 cursor-pointer flex items-center gap-1.5 rounded-nm-sm"
      title={isAuto ? "Scale: auto-detected. Click to override." : "Scale: manual override. Click to reset to auto."}
    >
      <ActivityIcon width="10" height="10" />
      {effectiveLog ? "Log" : "Linear"}
      {isAuto && (
        <span className="opacity-50">auto</span>
      )}
    </button>
  )
}

export { LogScaleToggle }
export type { LogScaleToggleProps }
