// src/components/dashboard/RankProgress.tsx
//
// Functions: extractRankHistory, RankProgressBar, RankTimeline, RankProgress

"use client"

import { useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { RedactedText } from "@/components/ui/RedactedText"
import type { TrackerUserClass } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import type { Snapshot } from "@/types/api"

interface RankChange {
  from: string
  to: string
  date: string
}

function extractRankHistory(snapshots: Snapshot[]): RankChange[] {
  const changes: RankChange[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]
    if (!prev.group || !curr.group) continue
    if (prev.group === curr.group) continue
    // Skip noise from privacy mode toggling — redacted markers changing
    // (i.e "▓8" → "▓9") aren't real rank changes
    if (isRedacted(prev.group) || isRedacted(curr.group)) continue
    changes.push({
      from: prev.group,
      to: curr.group,
      date: curr.polledAt,
    })
  }
  return changes
}

// ── Progress Bar ──

interface RankProgressBarProps {
  userClasses: TrackerUserClass[]
  currentRank: string | null
  accentColor: string
}

function RankProgressBar({ userClasses, currentRank, accentColor }: RankProgressBarProps) {
  if (userClasses.length === 0 || !currentRank || isRedacted(currentRank)) return null

  const currentIndex = userClasses.findIndex(
    (uc) => uc.name.toLowerCase() === currentRank.toLowerCase()
  )

  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto pt-1 pb-3 styled-scrollbar">
      {userClasses.map((uc, i) => {
        const isPast = currentIndex >= 0 && i < currentIndex
        const isCurrent = i === currentIndex
        const isFuture = currentIndex >= 0 && i > currentIndex

        return (
          <div key={uc.name} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <div
                className="w-4 h-px shrink-0"
                style={{
                  backgroundColor:
                    isPast || isCurrent
                      ? hexToRgba(accentColor, 0.5)
                      : CHART_THEME.borderEmphasis,
                }}
              />
            )}
            <div
              className="px-3 py-1.5 text-xs font-mono transition-all duration-150 shrink-0 rounded-nm-pill"
              style={{
                ...(isCurrent
                  ? {
                      backgroundColor: hexToRgba(accentColor, 0.15),
                      color: accentColor,
                      fontWeight: 600,
                      boxShadow: `0 0 12px ${hexToRgba(accentColor, 0.2)}`,
                    }
                  : isPast
                    ? {
                        backgroundColor: hexToRgba(accentColor, 0.06),
                        color: hexToRgba(accentColor, 0.6),
                      }
                    : isFuture
                      ? {
                          backgroundColor: "transparent",
                          color: CHART_THEME.borderMid,
                          border: `1px dashed ${CHART_THEME.borderEmphasis}`,
                        }
                      : { color: CHART_THEME.borderMid }),
              }}
            >
              {uc.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Timeline ──

interface RankTimelineProps {
  rankHistory: RankChange[]
  accentColor: string
}

function RankTimeline({ rankHistory, accentColor }: RankTimelineProps) {
  if (rankHistory.length === 0) return null

  return (
    <div className="flex flex-col gap-0">
      {[...rankHistory].reverse().map((change, i) => {
        const dateStr = new Date(change.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })

        return (
          <div key={`${change.date}-${change.to}`} className="flex items-start gap-3 relative">
            {/* Timeline line */}
            <div className="flex flex-col items-center shrink-0 w-4">
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{
                  backgroundColor: i === 0 ? accentColor : hexToRgba(accentColor, 0.4),
                  boxShadow: i === 0 ? `0 0 8px ${hexToRgba(accentColor, 0.4)}` : "none",
                }}
              />
              {i < rankHistory.length - 1 && (
                <div
                  className="w-px flex-1 min-h-[24px]"
                  style={{ backgroundColor: hexToRgba(accentColor, 0.15) }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex flex-col gap-0.5 pb-4">
              <span className="text-[11px] font-mono text-muted">{dateStr}</span>
              <span className="text-sm font-mono text-secondary">
                <RedactedText value={change.from} color="var(--color-tertiary)" className="text-tertiary" />
                <span className="text-muted mx-1.5">→</span>
                <RedactedText value={change.to} color={accentColor} className="font-semibold" />
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Combined component ──

interface RankProgressProps {
  userClasses: TrackerUserClass[]
  currentRank: string | null
  snapshots: Snapshot[]
  accentColor: string
}

function RankProgress({ userClasses, currentRank, snapshots, accentColor }: RankProgressProps) {
  const [expanded, setExpanded] = useState(true)
  const rankHistory = extractRankHistory(snapshots)
  const hasProgressBar = userClasses.length > 0 && currentRank

  if (!hasProgressBar && rankHistory.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-xs font-sans font-medium text-tertiary uppercase tracking-wider hover:text-secondary transition-colors duration-150 cursor-pointer w-fit"
      >
        <ChevronToggle expanded={expanded} />
        Rank Progression
      </button>

      {expanded && (
        <>
          {hasProgressBar && (
            <RankProgressBar
              userClasses={userClasses}
              currentRank={currentRank}
              accentColor={accentColor}
            />
          )}

          <RankTimeline
            rankHistory={rankHistory}
            accentColor={accentColor}
          />
        </>
      )}
    </div>
  )
}

export { RankProgress, extractRankHistory }
export type { RankChange, RankProgressProps }
