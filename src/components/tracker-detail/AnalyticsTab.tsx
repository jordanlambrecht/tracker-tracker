// src/components/tracker-detail/AnalyticsTab.tsx
//
// Functions: AnalyticsTab
//
// Renders the Data & Analytics tab with a unified bento grid for all stat cards
// (core stats + slot cards). Three responsive grids: 2-col (mobile), 3-col (md),
// 3-or-4-col (lg). Each grid uses its own layout algorithm with explicit positioning.

"use client"

import clsx from "clsx"
import { type ReactNode, useMemo } from "react"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { AnalyticsCharts } from "@/components/tracker-detail/AnalyticsCharts"
import { buildCoreStatDescriptors } from "@/components/tracker-detail/CoreStatCards"
import { PollLog } from "@/components/tracker-detail/PollLog"
import { SlotRenderer } from "@/components/tracker-detail/SlotRenderer"
import { StatCard } from "@/components/ui/StatCard"
import {
  findOptimalLayout2Col,
  findOptimalLayout3Col,
  findOptimalLayout4Col,
  getCardClasses,
  type LayoutConfig,
} from "@/lib/grid-layout"
import type { ResolvedSlot } from "@/lib/slot-types"
import type { GazellePlatformMeta, Snapshot, TrackerLatestStats, TrackerSummary } from "@/types/api"
import { renderSlotElement } from "./slot-registry"

interface AnalyticsTabProps {
  tracker: TrackerSummary
  snapshots: Snapshot[]
  stats: TrackerLatestStats | null
  latestSnapshot: Snapshot | null
  gazelleMeta: GazellePlatformMeta | null
  accentColor: string
  days: DayRange
  onDaysChange: (d: DayRange) => void
  delta: { uploaded: string; downloaded: string } | null
  minimumRatio?: number
  statCardSlots: ResolvedSlot[]
  progressSlots: ResolvedSlot[]
}

export function AnalyticsTab({
  tracker,
  snapshots,
  stats,
  latestSnapshot,
  gazelleMeta,
  accentColor: tc,
  days,
  onDaysChange,
  delta,
  minimumRatio,
  statCardSlots,
  progressSlots,
}: AnalyticsTabProps) {
  // Build core stat descriptors (data, not elements)
  const coreDescriptors = useMemo(
    () => buildCoreStatDescriptors(stats, latestSnapshot, minimumRatio),
    [stats, latestSnapshot, minimumRatio]
  )
  const coreCount = coreDescriptors.length

  // Count singles and doubles among slot cards
  const singleSlotCount = statCardSlots.filter((s) => s.span !== 2).length
  const doubleSlotCount = statCardSlots.filter((s) => s.span === 2).length

  // Compute layouts for each responsive breakpoint
  const totalS = coreCount + singleSlotCount
  const totalD = doubleSlotCount
  const layout4 = useMemo(() => findOptimalLayout4Col(totalS, totalD), [totalS, totalD])
  const layout3 = useMemo(() => findOptimalLayout3Col(totalS, totalD), [totalS, totalD])
  const layout2 = useMemo(() => findOptimalLayout2Col(totalS, totalD), [totalS, totalD])

  // Memoize slot partitions for stable references
  const singleSlots = useMemo(() => statCardSlots.filter((s) => s.span !== 2), [statCardSlots])
  const doubleSlots = useMemo(() => statCardSlots.filter((s) => s.span === 2), [statCardSlots])

  // Render cards for a given layout. Maps card IDs to React elements:
  // s1..s{coreCount} → core stats, s{coreCount+1}+ → slot singles,
  // t1..tN → promoted slot doubles (first T), d1..dN → remaining slot doubles
  const renderLayoutCards = (layout: LayoutConfig) =>
    layout.cards.map((card) => {
      const positionClasses = getCardClasses(card)
      const isTall = card.span > 1
      let element: ReactNode = null

      if (card.type === "fixed" || card.type === "single") {
        const num = Number.parseInt(card.id.slice(1), 10) - 1
        if (num < coreCount) {
          const d = coreDescriptors[num]
          element = (
            <StatCard
              label={d.label}
              value={d.value}
              accentColor={tc}
              icon={d.icon}
              unit={d.unit}
              subtitle={d.subtitle}
              trend={d.trend}
              tooltip={d.tooltip}
              alert={d.alert}
              alertReason={d.alertReason}
            />
          )
        } else {
          const slotIdx = num - coreCount
          const slot = singleSlots[slotIdx]
          if (slot) element = renderSlotElement(slot)
        }
      } else if (card.type === "double" || card.type === "triple") {
        const num = Number.parseInt(card.id.slice(1), 10) - 1
        // Triples map to first T slot doubles; remaining doubles start at offset T
        const slotIdx = card.type === "triple" ? num : layout.triples + num
        const slot = doubleSlots[slotIdx]
        if (slot) element = renderSlotElement(slot)
      }

      if (!element) return null

      return (
        <div key={card.id} className={clsx(positionClasses, isTall && "[&>*]:h-full")}>
          {element}
        </div>
      )
    })

  const lgColClass = layout4.cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"

  return (
    <div className="flex flex-col gap-10">
      <SlotRenderer slots={progressSlots} className="flex flex-col gap-10" />

      {/* Mobile: 2-col with explicit positioning */}
      <div className="grid grid-cols-2 gap-5 md:hidden">{renderLayoutCards(layout2)}</div>

      {/* Medium: 3-col with explicit positioning */}
      <div className="hidden gap-5 md:grid md:grid-cols-3 lg:hidden">
        {renderLayoutCards(layout3)}
      </div>

      {/* Large: 3 or 4-col with explicit positioning */}
      <div className={`hidden gap-5 lg:grid ${lgColClass}`}>{renderLayoutCards(layout4)}</div>

      <hr className="border-border" />
      <PollLog
        snapshots={snapshots}
        lastPolledAt={tracker.lastPolledAt}
        lastError={tracker.lastError}
      />
      <AnalyticsCharts
        trackerName={tracker.name}
        platformType={tracker.platformType}
        snapshots={snapshots}
        accentColor={tc}
        days={days}
        onDaysChange={onDaysChange}
        delta={delta}
        gazelleMeta={gazelleMeta}
        minimumRatio={minimumRatio}
      />
    </div>
  )
}
