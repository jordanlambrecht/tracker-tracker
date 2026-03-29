// src/components/dashboard/AnalyticsSection.tsx
"use client"

import { H2 } from "@typography"
import dynamic from "next/dynamic"
import { BufferCandlestickChart } from "@/components/charts/BufferCandlestickChart"
import { BufferVelocityChart } from "@/components/charts/BufferVelocityChart"
import { ComparisonChart } from "@/components/charts/ComparisonChart"
import { DailyVolumeChart } from "@/components/charts/DailyVolumeChart"
import { DistributionChart } from "@/components/charts/DistributionChart"
import { FleetCompositionChart } from "@/components/charts/FleetCompositionChart"
import { FleetVolumeCalendar } from "@/components/charts/FleetVolumeCalendar"
import { FleetVolumeHeatmap } from "@/components/charts/FleetVolumeHeatmap"
import { RankTenureChart } from "@/components/charts/RankTenureChart"
import { RatioStabilityChart } from "@/components/charts/RatioStabilityChart"
import { SeedbonusRiverChart } from "@/components/charts/SeedbonusRiverChart"
import { TrackerBubbleChart } from "@/components/charts/TrackerBubbleChart"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { DASHBOARD_CHARTS, useChartPreferences } from "@/components/dashboard/useChartPreferences"
import { ChevronUpIcon } from "@/components/ui/Icons"
import type { TrackerSummary } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

const VolumeSurface3D = dynamic(
  () => import("@/components/charts/VolumeSurface3D").then((m) => m.VolumeSurface3D),
  { ssr: false }
)

const allChartIds = DASHBOARD_CHARTS.filter((c) => c.category === "analytics").map((c) => c.id)

interface AnalyticsSectionProps {
  trackerSeries: TrackerSnapshotSeries[]
  trackers: TrackerSummary[]
}

function AnalyticsSection({ trackerSeries, trackers }: AnalyticsSectionProps) {
  const chartPrefs = useChartPreferences()
  const { hydrated: chartPrefsHydrated, orderedCharts } = chartPrefs

  const analyticsCharts = orderedCharts("analytics")
  const visibleChartCount = analyticsCharts.filter((c) => !chartPrefs.isHidden(c.id)).length
  const hiddenChartCount = analyticsCharts.length - visibleChartCount
  const allChartsCollapsed = chartPrefs.allVisibleCollapsed(allChartIds)

  function renderChart(id: string) {
    switch (id) {
      case "daily-volume":
        return <DailyVolumeChart trackerData={trackerSeries} height={360} />
      case "upload-landscape":
        return <VolumeSurface3D trackerData={trackerSeries} height={420} />
      case "distribution":
        return (
          <DistributionChart
            trackers={trackers.map((t) => ({
              name: t.name,
              color: t.color,
              uploadedBytes: t.latestStats?.uploadedBytes ?? null,
              seedingCount: t.latestStats?.seedingCount ?? null,
            }))}
          />
        )
      case "comparison-uploaded":
        return (
          <ComparisonChart
            metric="uploaded"
            trackerData={trackerSeries}
            height={320}
            enableLogScale
            enableStacked
          />
        )
      case "comparison-downloaded":
        return (
          <ComparisonChart
            metric="downloaded"
            trackerData={trackerSeries}
            height={320}
            enableLogScale
            enableStacked
          />
        )
      case "comparison-ratio":
        return (
          <ComparisonChart
            metric="ratio"
            trackerData={trackerSeries}
            height={320}
            enableLogScale
            enableAverage
          />
        )
      case "comparison-buffer":
        return (
          <ComparisonChart
            metric="buffer"
            trackerData={trackerSeries}
            height={320}
            enableLogScale
          />
        )
      case "comparison-seedbonus":
        return (
          <ComparisonChart
            metric="seedbonus"
            trackerData={trackerSeries}
            height={320}
            enableLogScale
          />
        )
      case "comparison-active":
        return (
          <ComparisonChart
            metric="active"
            trackerData={trackerSeries}
            height={320}
            enableLogScale
            enableStacked
          />
        )
      case "ratio-stability":
        return <RatioStabilityChart trackerData={trackerSeries} height={360} />
      case "fleet-composition":
        return <FleetCompositionChart trackerData={trackerSeries} height={360} />
      case "rank-tenure":
        return <RankTenureChart trackerData={trackerSeries} height={300} />
      case "buffer-velocity":
        return <BufferVelocityChart trackerData={trackerSeries} height={320} />
      case "buffer-candlestick":
        return <BufferCandlestickChart trackerData={trackerSeries} height={360} />
      case "tracker-landscape":
        return (
          <TrackerBubbleChart
            trackers={trackers.map((t) => ({
              name: t.name,
              color: t.color,
              uploadedBytes: t.latestStats?.uploadedBytes ?? null,
              downloadedBytes: t.latestStats?.downloadedBytes ?? null,
              seedingCount: t.latestStats?.seedingCount ?? null,
            }))}
            height={360}
          />
        )
      case "seedbonus-flow":
        return <SeedbonusRiverChart trackerData={trackerSeries} height={320} />
      case "volume-heatmap":
        return <FleetVolumeHeatmap trackerData={trackerSeries} height={260} />
      case "volume-calendar":
        return <FleetVolumeCalendar trackerData={trackerSeries} height={200} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <H2>Analytics</H2>
          {hiddenChartCount > 0 && <span className="timestamp">{hiddenChartCount} hidden</span>}
        </div>
        <button
          type="button"
          onClick={() => chartPrefs.collapseAll(allChartIds)}
          className="timestamp flex items-center gap-2 px-2.5 py-1 hover:text-secondary nm-interactive-inset cursor-pointer rounded-nm-sm"
        >
          <ChevronUpIcon
            width="12"
            height="12"
            className="transition-transform duration-200"
            style={{
              transform: allChartsCollapsed ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
          {allChartsCollapsed ? "Expand All" : "Collapse All"}
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {analyticsCharts.map((def) => {
          if (chartPrefs.isHidden(def.id)) return null
          return (
            <ChartCard
              key={def.id}
              title={def.label}
              description={def.description}
              collapsed={!chartPrefsHydrated || chartPrefs.isCollapsed(def.id)}
              onToggleCollapse={() => chartPrefs.toggleCollapsed(def.id)}
              onHide={() => chartPrefs.toggleHidden(def.id)}
            >
              {renderChart(def.id)}
            </ChartCard>
          )
        })}
      </div>
    </div>
  )
}

export { AnalyticsSection }
