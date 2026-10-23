// src/components/dashboard/RankProgress.tsx
"use client"

import clsx from "clsx"
import type { CSSProperties } from "react"
import { useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { RedactedText } from "@/components/ui/RedactedText"
import { SectionToggle } from "@/components/ui/SectionToggle"
import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/color-utils"
import { isRedacted } from "@/lib/privacy"
import type { RankForest } from "@/lib/rank-ladder"
import {
  buildRankForest,
  findClassIndex,
  ladderPosition,
  OUTSIDE_LADDER_NOTE,
} from "@/lib/rank-ladder"
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

interface RankForestBarProps {
  forest: RankForest
  userClasses: TrackerUserClass[]
  accentColor: string
}

interface RankTimelineProps {
  events: TimelineEvent[]
  accentColor: string
}

interface RankProgressProps {
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
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

type RankLocation =
  { kind: "shared"; index: number } | { kind: "path"; pathId: string; index: number }

function locateRank(name: string, userClasses: TrackerUserClass[]): RankLocation | null {
  const match = userClasses.find(
    (userClass) => !userClass.outsideLadder && userClass.name.toLowerCase() === name.toLowerCase()
  )
  if (!match) return null

  const siblings = match.path
    ? userClasses.filter((userClass) => !userClass.outsideLadder && userClass.path === match.path)
    : userClasses.filter((userClass) => !userClass.outsideLadder && !userClass.path)
  const index = siblings.findIndex(
    (userClass) => userClass.name.toLowerCase() === name.toLowerCase()
  )
  if (index < 0) return null

  return match.path ? { kind: "path", pathId: match.path, index } : { kind: "shared", index }
}

/**
 * Shared classes come before every branch, so crossing the fork is a step in
 * either direction. A move between two different branches is neither: there is
 * no shared ordering between them.
 */
function classifyForestDirection(
  from: string,
  to: string,
  userClasses: TrackerUserClass[]
): "promotion" | "demotion" | "unknown" {
  const first = locateRank(from, userClasses)
  const second = locateRank(to, userClasses)
  if (!first || !second) return "unknown"

  if (first.kind === "shared" && second.kind === "shared") {
    if (first.index === second.index) return "unknown"
    return second.index > first.index ? "promotion" : "demotion"
  }
  if (first.kind === "path" && second.kind === "path") {
    if (first.pathId !== second.pathId || first.index === second.index) return "unknown"
    return second.index > first.index ? "promotion" : "demotion"
  }
  return first.kind === "shared" ? "promotion" : "demotion"
}

function classifyDirection(
  from: string,
  to: string,
  userClasses: TrackerUserClass[],
  rankPaths?: TrackerRankPath[]
): "promotion" | "demotion" | "unknown" {
  if (rankPaths && rankPaths.length > 0) {
    return classifyForestDirection(from, to, userClasses)
  }

  // An above class is granted or bought rather than earned, so a move into or
  // out of one is neither a promotion nor a demotion.
  const isAbove = (name: string) =>
    userClasses[findClassIndex(userClasses, name)]?.outsideLadder === "above"
  if (isAbove(from) || isAbove(to)) return "unknown"
  const fromPos = ladderPosition(userClasses, from)
  const toPos = ladderPosition(userClasses, to)
  if (fromPos === null || toPos === null || fromPos === toPos) return "unknown"
  return toPos > fromPos ? "promotion" : "demotion"
}

type RankChipState = "current" | "past" | "future" | "outside"

function chipStyle(state: RankChipState, accentColor: string): CSSProperties {
  if (state === "current") {
    return {
      backgroundColor: hexToRgba(accentColor, 0.15),
      color: accentColor,
      fontWeight: 600,
      boxShadow: `0 0 12px ${hexToRgba(accentColor, 0.2)}`,
    }
  }
  if (state === "past") {
    return {
      backgroundColor: hexToRgba(accentColor, 0.06),
      color: hexToRgba(accentColor, 0.6),
    }
  }
  if (state === "future") {
    return {
      backgroundColor: "transparent",
      color: CHART_THEME.borderMid,
      border: `1px dashed ${CHART_THEME.borderEmphasis}`,
    }
  }
  return { color: CHART_THEME.textSecondary }
}

function RankChip({
  name,
  state,
  accentColor,
  title,
}: {
  name: string
  state: RankChipState
  accentColor: string
  title?: string
}) {
  return (
    <div
      className={clsx(
        "px-3 py-1.5 text-xs font-mono transition-all duration-150 shrink-0 rounded-nm-pill",
        state === "outside" && "opacity-60"
      )}
      title={title}
      style={chipStyle(state, accentColor)}
    >
      {name}
    </div>
  )
}

function chipStateFor(index: number, currentIndex: number): RankChipState {
  if (currentIndex < 0) return "future"
  if (index === currentIndex) return "current"
  return index < currentIndex ? "past" : "future"
}

function RankProgressBar({ userClasses, currentRank, accentColor }: RankProgressBarProps) {
  if (userClasses.length === 0 || !currentRank || isRedacted(currentRank)) return null

  const currentIndex = findClassIndex(userClasses, currentRank)
  const currentPos = ladderPosition(userClasses, currentRank)

  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto p-3 -m-3 styled-scrollbar">
      {userClasses.map((uc, i) => {
        const isCurrent = i === currentIndex
        const pos = uc.outsideLadder ? null : ladderPosition(userClasses, uc.name)
        const isPast = pos !== null && currentPos !== null && pos < currentPos
        const isFuture = pos !== null && currentPos !== null && pos > currentPos
        const state: RankChipState = isCurrent
          ? "current"
          : isPast
            ? "past"
            : isFuture
              ? "future"
              : "outside"

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
            <RankChip
              name={uc.name}
              state={state}
              accentColor={accentColor}
              title={uc.outsideLadder ? OUTSIDE_LADDER_NOTE[uc.outsideLadder] : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

function RankForestBar({ forest, userClasses, accentColor }: RankForestBarProps) {
  const outside = userClasses.filter((uc) => uc.outsideLadder)
  const appointed = forest.appointedClass !== null
  const activePathId = forest.activePathId

  const forkColor = (pathId: string | null) => {
    if (appointed) return hexToRgba(accentColor, 0.5)
    if (activePathId === null) return CHART_THEME.borderEmphasis
    return activePathId === pathId ? hexToRgba(accentColor, 0.5) : CHART_THEME.borderEmphasis
  }

  // The last shared class is the fork point, so it stays centered above the
  // stem; the classes before it hang to its left.
  const sharedState = (index: number): RankChipState =>
    appointed
      ? "past"
      : activePathId
        ? index <= forest.sharedCurrentIndex
          ? "past"
          : "future"
        : chipStateFor(index, forest.sharedCurrentIndex)

  return (
    <div className="nm-inset-sm bg-control-bg rounded-nm-md p-4 sm:p-5">
      <div className="flex w-full flex-col items-center">
        {/* Shared prefix, with its last rung centered on the fork stem. */}
        {forest.shared.length > 0 && (
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex items-center justify-end gap-1">
              {forest.shared.slice(0, -1).map((rung, index) => (
                <div key={rung.name} className="flex items-center gap-1 shrink-0">
                  {index > 0 && (
                    <div
                      className="w-5 h-px shrink-0"
                      style={{
                        backgroundColor:
                          sharedState(index) === "future"
                            ? CHART_THEME.borderEmphasis
                            : hexToRgba(accentColor, 0.5),
                      }}
                    />
                  )}
                  <RankChip name={rung.name} state={sharedState(index)} accentColor={accentColor} />
                  <div
                    className="w-5 h-px shrink-0"
                    style={{
                      backgroundColor:
                        sharedState(index + 1) === "future"
                          ? CHART_THEME.borderEmphasis
                          : hexToRgba(accentColor, 0.5),
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="shrink-0">
              <RankChip
                name={forest.shared[forest.shared.length - 1].name}
                state={sharedState(forest.shared.length - 1)}
                accentColor={accentColor}
              />
            </div>
            <div aria-hidden="true" />
          </div>
        )}

        {/* Fork: the shared rung drops into one line per path. On phones the
            paths stack, so the two diagonal branches collapse to one stem. */}
        {forest.paths.length === 2 ? (
          <>
            <svg
              viewBox="0 0 100 28"
              className="hidden md:block w-full h-7"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="8"
                stroke={CHART_THEME.borderEmphasis}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="50"
                y1="8"
                x2="25"
                y2="28"
                stroke={forkColor(forest.paths[0]?.id ?? null)}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="50"
                y1="8"
                x2="75"
                y2="28"
                stroke={forkColor(forest.paths[1]?.id ?? null)}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="h-5 w-px bg-border md:hidden" />
          </>
        ) : (
          <div className="h-5 w-px bg-border" />
        )}

        {/* One column per path, side by side on desktop and stacked on phones. */}
        <div className="flex w-full flex-col gap-6 md:grid md:grid-cols-2 md:gap-6">
          {forest.paths.map((path) => {
            const active = activePathId === path.id
            const dimmed = !appointed && activePathId !== null && !active
            return (
              <div
                key={path.id}
                className={clsx("flex flex-col items-center gap-2", dimmed && "opacity-50")}
              >
                <div className="flex flex-col items-center">
                  <span className="text-4xs font-mono uppercase tracking-wider text-tertiary">
                    {path.label}
                  </span>
                  {path.description && (
                    <span className="text-4xs font-mono text-muted">{path.description}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {path.rungs.map((rung, index) => {
                    const state: RankChipState = appointed
                      ? "past"
                      : active
                        ? chipStateFor(index, path.currentIndex)
                        : "future"
                    return (
                      <div key={rung.name} className="flex items-center gap-1 shrink-0">
                        {index > 0 && (
                          <div
                            className="w-4 h-px shrink-0"
                            style={{
                              backgroundColor:
                                state === "future"
                                  ? CHART_THEME.borderEmphasis
                                  : hexToRgba(accentColor, 0.5),
                            }}
                          />
                        )}
                        <RankChip name={rung.name} state={state} accentColor={accentColor} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {outside.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1 pt-4">
            {outside.map((uc) => (
              <RankChip
                key={uc.name}
                name={uc.name}
                state={
                  uc.name.toLowerCase() === forest.shownClass?.toLowerCase() ? "current" : "outside"
                }
                accentColor={accentColor}
                title={uc.outsideLadder ? OUTSIDE_LADDER_NOTE[uc.outsideLadder] : undefined}
              />
            ))}
          </div>
        )}
      </div>
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
  rankPaths,
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
    direction: classifyDirection(change.from, change.to, userClasses, rankPaths),
  }))

  const milestone = checkAnniversaryMilestone(joinedAt)
  if (milestone) {
    events.push({ kind: "anniversary", label: milestone.label })
  }

  const hasProgressBar = userClasses.length > 0 && currentRank
  const forest =
    rankPaths && rankPaths.length > 0 && currentRank
      ? buildRankForest(userClasses, rankPaths, currentRank)
      : null

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
          {hasProgressBar &&
            (forest ? (
              <RankForestBar forest={forest} userClasses={userClasses} accentColor={accentColor} />
            ) : (
              <RankProgressBar
                userClasses={userClasses}
                currentRank={currentRank}
                accentColor={accentColor}
              />
            ))}

          <RankTimeline events={events} accentColor={accentColor} />
        </>
      )}
    </div>
  )
}

export type { RankChange, RankProgressProps, TimelineEvent }
export { extractRankHistory, RankProgress }
