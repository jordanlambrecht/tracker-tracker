// src/components/dashboard/DashboardSettingsSheet.tsx
//
// Functions: SortableChartItem, DashboardSettingsSheet

"use client"

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCallback, useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import type { ChartDef } from "@/components/dashboard/useChartPreferences"
import { useChartPreferences } from "@/components/dashboard/useChartPreferences"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { Sheet } from "@/components/ui/Sheet"
import { TabBar } from "@/components/ui/TabBar"
import { Toggle } from "@/components/ui/Toggle"
import { H2 } from "@/components/ui/Typography"

interface SortableChartItemProps {
  def: ChartDef
  isHidden: boolean
  onToggle: (visible: boolean) => void
}

function SortableChartItem({ def, isHidden, onToggle }: SortableChartItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: def.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2 px-3 nm-raised-sm rounded-nm-md bg-elevated"
    >
      <button
        type="button"
        className="text-muted hover:text-secondary cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <Toggle
        label={def.label}
        checked={!isHidden}
        onChange={onToggle}
      />
    </div>
  )
}

interface DashboardSettingsSheetProps {
  open: boolean
  onClose: () => void
}

function DashboardSettingsSheet({ open, onClose }: DashboardSettingsSheetProps) {
  const [chartSettingsTab, setChartSettingsTab] = useState<"analytics" | "torrents">("analytics")

  const chartPrefs = useChartPreferences()
  const { orderedCharts, reorder } = chartPrefs
  const dashSettings = useDashboardSettings()

  const handleChartDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const currentOrder = orderedCharts(chartSettingsTab).map((c) => c.id)
      const oldIndex = currentOrder.indexOf(active.id as string)
      const newIndex = currentOrder.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return
      const otherCategory = chartSettingsTab === "analytics" ? "torrents" : "analytics"
      const otherOrder = orderedCharts(otherCategory).map((c) => c.id)
      const reordered = arrayMove(currentOrder, oldIndex, newIndex)
      reorder([...reordered, ...otherOrder])
    },
    [orderedCharts, reorder, chartSettingsTab]
  )

  return (
    <Sheet open={open} onClose={onClose} title="Dashboard Settings">
      <div className="p-6 flex flex-col gap-8">
        {/* Trackers */}
        <div className="flex flex-col gap-4">
          <H2>Trackers</H2>
          <Toggle
            label="Show health indicators"
            description="Display the breathing pulse dot on each tracker card showing connection status."
            checked={dashSettings.settings.showHealthIndicators}
            onChange={(checked) => dashSettings.update("showHealthIndicators", checked)}
          />
        </div>

        <div
          className="h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${CHART_THEME.borderEmphasis}, transparent)`,
          }}
        />

        {/* Chart Visibility & Order */}
        <div className="flex flex-col gap-4">
          <H2>Charts</H2>
          <TabBar
            tabs={[
              { key: "analytics" as const, label: "Analytics" },
              { key: "torrents" as const, label: "Torrents" },
            ]}
            activeTab={chartSettingsTab}
            onChange={setChartSettingsTab}
          />
          <p className="text-xs font-sans text-tertiary">
            {chartSettingsTab === "analytics"
              ? "Toggle visibility and drag to reorder analytics charts."
              : "Toggle visibility and drag to reorder torrent charts."}
          </p>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleChartDragEnd}>
            <SortableContext
              items={orderedCharts(chartSettingsTab).map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {orderedCharts(chartSettingsTab).map((def) => (
                  <SortableChartItem
                    key={def.id}
                    def={def}
                    isHidden={chartPrefs.isHidden(def.id)}
                    onToggle={(visible) => chartPrefs.setVisible(def.id, visible)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </Sheet>
  )
}

export { DashboardSettingsSheet }
