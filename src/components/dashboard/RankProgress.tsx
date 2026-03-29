// src/components/dashboard/RankProgress.tsx
"use client"

import { useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { RedactedText } from "@/components/ui/RedactedText"
import { SectionToggle } from "@/components/ui/SectionToggle"
import type { TrackerUserClass } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import { checkAnniversaryMilestone } from "@/lib/tracker-events"
import type { Snapshot } from "@/types/api"

// ── Types ──

interface RankChange {
  from: string
  to: string
  date: string
}

type TimelineEvent =
  | {
      kind: "rank"
      from: string
      to: string
      date: string
      direction: "promotion" | "demotion" | "unknown"
    }
  | { kind: "anniversary"; label: string }

interface RankProgressBarProps {
  userClasses: TrackerUserClass[]
  currentRank: string | null
  accentColor: string
}

interface RankTimelineProps {
  events: TimelineEvent[]
  accentColor: string
}

interface RankProgressProps {
  userClasses: TrackerUserClass[]
  currentRank: string | null
  snapshots: Snapshot[]
  accentColor: string
  joinedAt?: string | null
}

// ── Helpers ──

function extractRankHistory(snapshots: Snapshot[]): RankChange[] {
  const changes: RankChange[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]
    if (!prev.group || !curr.group) continue
    if (prev.group === curr.group) continue
    if (isRedacted(prev.group) || isRedacted(curr.group)) continue
    changes.push({
      from: prev.group,
      to: curr.group,
      date: curr.polledAt,
    })
  }
  return changes
}

function classifyDirection(
  from: string,
  to: string,
  userClasses: TrackerUserClass[]
): "promotion" | "demotion" | "unknown" {
  if (userClasses.length === 0) return "unknown"
  const fromIdx = userClasses.findIndex((uc) => uc.name.toLowerCase() === from.toLowerCase())
  const toIdx = userClasses.findIndex((uc) => uc.name.toLowerCase() === to.toLowerCase())
  if (fromIdx === -1 || toIdx === -1) return "unknown"
  return toIdx > fromIdx ? "promotion" : "demotion"
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
                    isPast || isCurrent ? hexToRgba(accentColor, 0.5) : CHART_THEME.borderEmphasis,
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

function RankTimeline({ events, accentColor }: RankTimelineProps) {
  if (events.length === 0) return null

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-2 styled-scrollbar">
      {events.map((event) => {
        if (event.kind === "anniversary") {
          return (
            <div key={`anniv-${event.label}`} className="flex flex-col items-center gap-2 shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 0 8px ${hexToRgba(accentColor, 0.4)}`,
                }}
              />
              <span className="text-3xs font-mono whitespace-nowrap" style={{ color: accentColor }}>
                {event.label}
              </span>
            </div>
          )
        }

        const dirColor =
          event.direction === "promotion"
            ? CHART_THEME.success
            : event.direction === "demotion"
              ? CHART_THEME.danger
              : accentColor
        const dirIcon =
          event.direction === "promotion" ? "▲" : event.direction === "demotion" ? "▼" : "→"

        const dateStr = new Date(event.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })

        return (
          <div key={`${event.date}-${event.to}`} className="flex flex-col gap-0.5 shrink-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-4xs leading-none shrink-0" style={{ color: dirColor }}>
                {dirIcon}
              </span>
              <span className="text-xs font-mono text-secondary">
                <RedactedText
                  value={event.from}
                  color="var(--color-tertiary)"
                  className="text-tertiary"
                />
                <span className="text-muted mx-1">→</span>
                <RedactedText value={event.to} color={dirColor} className="font-semibold" />
              </span>
            </div>
            <span className="timestamp whitespace-nowrap pl-4">{dateStr}</span>
          </div>
        )
      })}
    </div>
  )
}

function RankProgress({
  userClasses,
  currentRank,
  snapshots,
  accentColor,
  joinedAt,
}: RankProgressProps) {
  const [expanded, setExpanded] = useState(true)
  const rankHistory = extractRankHistory(snapshots)

  // Build timeline events for rank changes + anniversary milestone
  const events: TimelineEvent[] = [...rankHistory].reverse().map((change) => ({
    kind: "rank" as const,
    from: change.from,
    to: change.to,
    date: change.date,
    direction: classifyDirection(change.from, change.to, userClasses),
  }))

  const milestone = checkAnniversaryMilestone(joinedAt)
  if (milestone) {
    events.push({ kind: "anniversary", label: milestone.label })
  }

  const hasProgressBar = userClasses.length > 0 && currentRank

  if (!hasProgressBar && events.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <SectionToggle
        label="Rank Progression"
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      {expanded && (
        <>
          {hasProgressBar && (
            <RankProgressBar
              userClasses={userClasses}
              currentRank={currentRank}
              accentColor={accentColor}
            />
          )}

          <RankTimeline events={events} accentColor={accentColor} />
        </>
      )}
    </div>
  )
}

export type { RankChange, RankProgressProps, TimelineEvent }
export { extractRankHistory, RankProgress }
