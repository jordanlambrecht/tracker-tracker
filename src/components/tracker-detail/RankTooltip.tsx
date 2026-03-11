// src/components/tracker-detail/RankTooltip.tsx

"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/Badge"
import type { TrackerUserClass } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/formatters"

interface RankTooltipProps {
  currentRank: string
  userClasses: TrackerUserClass[]
  accentColor: string
}

export function RankTooltip({ currentRank, userClasses, accentColor }: RankTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex">
      <Badge
        style={{
          backgroundColor: hexToRgba(accentColor, 0.15),
          color: accentColor,
        }}
      >
        <span className="flex items-center gap-1.5">
          {currentRank}
          <button
            type="button"
            className="cursor-help text-[9px] font-bold opacity-70 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current bg-transparent p-0"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            aria-label="Show rank progression"
          >
            ?
          </button>
        </span>
      </Badge>

      {open && (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover-keep-open for tooltip panel
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-elevated nm-raised-sm py-2 px-1 min-w-[200px] rounded-nm-md"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-[10px] font-sans font-medium text-tertiary uppercase tracking-wider px-3 pb-1.5">
            Ranks
          </p>
          {userClasses.map((uc) => {
            const isCurrent = uc.name.toLowerCase() === currentRank.toLowerCase()
            return (
              <div
                key={uc.name}
                className="px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-2"
                style={isCurrent ? { color: accentColor, backgroundColor: hexToRgba(accentColor, 0.1) } : undefined}
              >
                <span className={isCurrent ? "font-semibold" : "text-secondary"}>
                  {uc.name}
                </span>
                {isCurrent && (
                  <span className="text-[10px]">← you</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
