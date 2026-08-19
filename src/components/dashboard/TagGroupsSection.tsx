// src/components/dashboard/TagGroupsSection.tsx
"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import {
  numbersNeedsWideCard,
  TagGroupBreakdownChart,
} from "@/components/charts/TagGroupBreakdownChart"
import { Card } from "@/components/ui"
import type { TagGroupBreakdown } from "@/lib/fleet-aggregation"

interface TagGroupsSectionProps {
  /** Already filtered by the aggregation. Callers skip rendering this on an empty array. */
  breakdowns: TagGroupBreakdown[]
  accentColor: string
}

/**
 * Tag group breakdown cards. Shared by the dashboard (fleet-wide counts) and a tracker's
 * Torrents tab (that tracker's counts). The two differ only in which breakdowns they pass.
 */
function TagGroupsSection({ breakdowns, accentColor }: TagGroupsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {breakdowns.map(({ group, memberCounts, unmatchedCount }) => {
        const effectiveCount =
          memberCounts.length + (group.countUnmatched && unmatchedCount != null ? 1 : 0)
        const isSingleNumber = group.chartType === "numbers" && effectiveCount === 1
        const wideCard =
          group.chartType === "numbers" &&
          numbersNeedsWideCard(memberCounts.length, group.countUnmatched, unmatchedCount)
        return (
          <Card
            key={group.id}
            trackerColor={accentColor}
            className={clsx(
              "flex flex-col gap-4",
              wideCard && "lg:col-span-2",
              isSingleNumber && "min-h-48"
            )}
          >
            <H2 className="card-heading">
              {group.emoji ? `${group.emoji} ` : ""}
              {group.name}
            </H2>
            <TagGroupBreakdownChart
              groupName={group.name}
              members={memberCounts}
              accentColor={accentColor}
              chartType={group.chartType}
              countUnmatched={group.countUnmatched}
              unmatchedCount={unmatchedCount}
            />
          </Card>
        )
      })}
    </div>
  )
}

export { TagGroupsSection }
