// src/components/dashboard/TodayAtAGlance.tsx

"use client"

import { H2 } from "@typography"
import { FleetActivity } from "@/components/dashboard/FleetActivity"
import { FleetHeadline } from "@/components/dashboard/FleetHeadline"
import { MoversAndShakers } from "@/components/dashboard/MoversAndShakers"
import { TrackerBreakdownBars } from "@/components/dashboard/TrackerBreakdownBars"
import { TrackerBreakdownTicker } from "@/components/dashboard/TrackerBreakdownTicker"
import { Card } from "@/components/ui/Card"
import { formatTimeAgo } from "@/lib/formatters"
import type { TodayAtAGlance as TodayAtAGlanceData } from "@/types/api"

interface TodayAtAGlanceProps {
  data: TodayAtAGlanceData
  variant?: "bars" | "ticker"
}

function UpdatedAt({ iso }: { iso: string | null }) {
  if (!iso) return null
  const ago = formatTimeAgo(new Date(iso))
  return (
    <span className="timestamp" title={iso}>
      Updated {ago}
    </span>
  )
}

export function TodayAtAGlance({ data, variant = "bars" }: TodayAtAGlanceProps) {
  const hasActivity =
    data.activity.addedToday > 0 ||
    data.activity.completedToday > 0 ||
    data.movers.topUploaders.length > 0 ||
    data.movers.topDownloaders.length > 0

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <FleetHeadline fleet={data.fleet} />

        <div className="border-t border-border" />

        {/* Tracker breakdowns — upload and download side by side on lg, stacked on mobile */}
        <div className="flex items-center justify-between">
          <H2 className="uppercase tracking-wider">By Tracker</H2>
          <UpdatedAt iso={data.trackerLastUpdated} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="nm-inset-sm rounded-nm-md p-4 flex flex-col gap-3">
            <H2 className="uppercase tracking-wider">Upload</H2>
            {variant === "bars" ? (
              <TrackerBreakdownBars trackers={data.trackers} metric="upload" />
            ) : (
              <TrackerBreakdownTicker trackers={data.trackers} />
            )}
          </div>

          <div className="nm-inset-sm rounded-nm-md p-4 flex flex-col gap-3">
            <H2 className="uppercase tracking-wider">Download</H2>
            {variant === "bars" ? (
              <TrackerBreakdownBars trackers={data.trackers} metric="download" />
            ) : (
              <TrackerBreakdownTicker trackers={data.trackers} />
            )}
          </div>
        </div>

        {hasActivity && (
          <>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <FleetActivity activity={data.activity} />
              <UpdatedAt iso={data.clientLastUpdated} />
            </div>
            <MoversAndShakers movers={data.movers} />
          </>
        )}
      </div>
    </Card>
  )
}
