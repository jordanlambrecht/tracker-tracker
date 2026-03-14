// src/components/tracker-detail/platform/GgnBuffsDisplay.tsx

import { H2 } from "@/components/ui/Typography"
import { hexToRgba } from "@/lib/formatters"
import type { GGnPlatformMeta } from "@/types/api"

export interface GgnBuffsDisplayProps {
  ggMeta: GGnPlatformMeta | null
  accentColor: string
}

export function GgnBuffsDisplay({ ggMeta, accentColor }: GgnBuffsDisplayProps) {
  if (!ggMeta?.buffs) return null

  const activeBuffs = Object.entries(ggMeta.buffs).filter(([, v]) => v !== 1)
  if (activeBuffs.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <H2>Active Buffs</H2>
      <div className="flex flex-wrap gap-2">
        {activeBuffs.map(([key, val]) => {
          const label = `${key.charAt(0).toUpperCase()}${key.slice(1)} ${val}x`
          const isBoost = val > 1
          return (
            <span
              key={key}
              className="inline-flex items-center px-2.5 py-1 font-mono text-xs nm-inset-sm rounded-nm-pill"
              style={{
                color: isBoost ? accentColor : "var(--color-warn)",
                backgroundColor: isBoost
                  ? hexToRgba(accentColor, 0.1)
                  : "var(--color-warn-dim)",
              }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
