// src/components/tracker-detail/RankTooltip.tsx
"use client"

import { SlotLabel } from "@typography"
import clsx from "clsx"
import { Badge } from "@/components/ui/Badge"
import { Tooltip } from "@/components/ui/Tooltip"
import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/color-utils"
import { buildRankForest, OUTSIDE_LADDER_NOTE } from "@/lib/rank-ladder"

interface RankTooltipProps {
  currentRank: string
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
  accentColor: string
}

function RankRow({
  userClass,
  isCurrent,
  dimmed,
  accentColor,
}: {
  userClass: TrackerUserClass
  isCurrent: boolean
  dimmed?: boolean
  accentColor: string
}) {
  return (
    <div
      className={clsx(
        "px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-2",
        (dimmed || userClass.outsideLadder) && "opacity-60"
      )}
      title={userClass.outsideLadder ? OUTSIDE_LADDER_NOTE[userClass.outsideLadder] : undefined}
      style={
        isCurrent ? { color: accentColor, backgroundColor: hexToRgba(accentColor, 0.1) } : undefined
      }
    >
      <span className={isCurrent ? "font-semibold" : "text-secondary"}>{userClass.name}</span>
      {isCurrent && <span className="text-3xs">&larr; you</span>}
    </div>
  )
}

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-4xs font-mono uppercase tracking-wider text-muted">
      {children}
    </div>
  )
}

export function RankTooltip({
  currentRank,
  userClasses,
  rankPaths,
  accentColor,
}: RankTooltipProps) {
  const forest =
    rankPaths && rankPaths.length > 0 ? buildRankForest(userClasses, rankPaths, currentRank) : null
  const outsideClasses = userClasses.filter((userClass) => userClass.outsideLadder)

  return (
    <Tooltip
      content={
        <div className="min-w-50 max-h-[70vh] overflow-y-auto styled-scrollbar">
          <SlotLabel label="Ranks" className="px-3 pb-1.5" />

          {forest ? (
            <>
              <GroupLabel>Shared</GroupLabel>
              {forest.shared.map((rung, index) => (
                <RankRow
                  key={rung.name}
                  userClass={userClasses.find((uc) => uc.name === rung.name) ?? { name: rung.name }}
                  isCurrent={forest.activePathId === null && index === forest.sharedCurrentIndex}
                  accentColor={accentColor}
                />
              ))}

              <div className="flex items-center gap-2 px-3 py-2">
                <span className="h-px flex-1 bg-border" />
                <span className="text-4xs font-mono uppercase tracking-wider text-muted">
                  {forest.paths.length} paths onward
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              {forest.paths.map((path) => (
                <div key={path.id}>
                  <GroupLabel>{path.label}</GroupLabel>
                  {path.rungs.map((rung, index) => (
                    <RankRow
                      key={rung.name}
                      userClass={
                        userClasses.find((uc) => uc.name === rung.name) ?? { name: rung.name }
                      }
                      isCurrent={forest.activePathId === path.id && index === path.currentIndex}
                      dimmed={forest.activePathId !== null && forest.activePathId !== path.id}
                      accentColor={accentColor}
                    />
                  ))}
                </div>
              ))}

              {outsideClasses.length > 0 && (
                <>
                  <GroupLabel>Other</GroupLabel>
                  {outsideClasses.map((userClass) => (
                    <RankRow
                      key={userClass.name}
                      userClass={userClass}
                      isCurrent={userClass.name.toLowerCase() === currentRank.toLowerCase()}
                      accentColor={accentColor}
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            userClasses.map((userClass) => (
              <RankRow
                key={userClass.name}
                userClass={userClass}
                isCurrent={userClass.name.toLowerCase() === currentRank.toLowerCase()}
                accentColor={accentColor}
              />
            ))
          )}
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
