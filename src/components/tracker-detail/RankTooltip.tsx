// src/components/tracker-detail/RankTooltip.tsx
"use client"

import { SlotLabel } from "@typography"
import { Badge } from "@/components/ui/Badge"
import { Tooltip } from "@/components/ui/Tooltip"
import type { TrackerUserClass } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/color-utils"

interface RankTooltipProps {
  currentRank: string
  userClasses: TrackerUserClass[]
  accentColor: string
}

export function RankTooltip({ currentRank, userClasses, accentColor }: RankTooltipProps) {
  return (
    <Tooltip
      content={
        <div className="min-w-50">
          <SlotLabel label="Ranks" className="px-3 pb-1.5" />
          {userClasses.map((uc) => {
            const isCurrent = uc.name.toLowerCase() === currentRank.toLowerCase()
            return (
              <div
                key={uc.name}
                className="px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-2"
                style={
                  isCurrent
                    ? { color: accentColor, backgroundColor: hexToRgba(accentColor, 0.1) }
                    : undefined
                }
              >
                <span className={isCurrent ? "font-semibold" : "text-secondary"}>{uc.name}</span>
                {isCurrent && <span className="text-3xs">&larr; you</span>}
              </div>
            )
          })}
        </div>
      }
    >
      <Badge
        tabIndex={0}
        style={{
          backgroundColor: hexToRgba(accentColor, 0.15),
          color: accentColor,
        }}
      >
        <span className="flex items-center gap-2">
          {currentRank}
          <span className="help-icon opacity-70" aria-hidden="true">
            ?
          </span>
        </span>
      </Badge>
    </Tooltip>
  )
}
