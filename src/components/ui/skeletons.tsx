// src/components/ui/skeletons.tsx

import { Card } from "./Card"
import { Shimmer } from "./Shimmer"

/**
 * A collapsed card shape
 */
function CardSkeleton() {
  return (
    <Card>
      <div className="flex items-center gap-3 px-1">
        <Shimmer rounded="full" className="h-4 w-4" />
        <Shimmer size="text" className="w-32" />
        <div className="flex-1" />
        <Shimmer size="label" className="w-16" />
      </div>
    </Card>
  )
}

/**
 * A list of card skeletons
 */
function CardListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={`card-${i}`} />
      ))}
    </div>
  )
}

/**
 * Event log skeleton
 */
function EventLogSkeleton({ rows = 6 }: { rows?: number }) {
  const widths = ["w-full", "w-5/6", "w-4/5", "w-full", "w-3/4", "w-5/6"]
  return (
    <div className="nm-inset-sm rounded-nm-md p-3 flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer key={`log-${i}`} size="text" className={widths[i % widths.length]} />
      ))}
    </div>
  )
}

/**
 * Chart grid skeleton
 */
function ChartGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <Card key={`chart-${i}`}>
          <div className="flex flex-col gap-4">
            <Shimmer size="heading" className="w-40" />
            <Shimmer className="h-48 w-full" rounded="md" />
          </div>
        </Card>
      ))}
    </div>
  )
}

/**
 * Stat row and table skeleton
 */
function TorrentTabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Stat pills row */}
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 5 }, (_, i) => (
          <Shimmer key={`stat-${i}`} className="h-9 w-28" rounded="md" />
        ))}
      </div>
      {/* Table-like rows */}
      <div className="nm-inset-sm rounded-nm-md p-4 flex flex-col gap-3">
        <div className="flex gap-4">
          <Shimmer size="text" className="w-16" />
          <Shimmer size="text" className="w-48" />
          <div className="flex-1" />
          <Shimmer size="text" className="w-20" />
          <Shimmer size="text" className="w-20" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={`row-${i}`} className="flex gap-4">
            <Shimmer size="text" className="w-16" />
            <Shimmer size="text" className="w-48" />
            <div className="flex-1" />
            <Shimmer size="text" className="w-20" />
            <Shimmer size="text" className="w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export { CardListSkeleton, CardSkeleton, ChartGridSkeleton, EventLogSkeleton, TorrentTabSkeleton }
