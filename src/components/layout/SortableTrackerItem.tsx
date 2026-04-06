// src/components/layout/SortableTrackerItem.tsx

"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import clsx from "clsx"
import Link from "next/link"
import type { CSSProperties } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { PulseDot } from "@/components/ui/PulseDot"
import { hexToRgba } from "@/lib/color-utils"
import { formatStatValue, type StatMode } from "@/lib/formatters"
import { getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

interface SortableTrackerItemProps {
  tracker: TrackerSummary
  isActive: boolean
  unlocked: boolean
  statMode: StatMode
  onToggleFavorite: (id: number, current: boolean) => void
}

function SortableTrackerItem({
  tracker,
  isActive,
  unlocked,
  statMode,
  onToggleFavorite,
}: SortableTrackerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tracker.id,
  })

  const archived = !tracker.isActive
  const health = getTrackerHealth(tracker)
  const tc = tracker.color || CHART_THEME.accent
  const stat = formatStatValue(tracker.latestStats, statMode)

  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const activeStyle: CSSProperties = isActive ? { backgroundColor: hexToRgba(tc, 0.08) } : {}

  const itemClasses = clsx(
    "w-full flex items-center gap-3 px-4 py-3 text-left group rounded-nm-md",
    unlocked ? "animate-jiggle cursor-grab" : "cursor-pointer",
    archived && "opacity-40",
    isActive ? "text-primary nm-raised-sm" : "text-secondary nm-interactive-sm hover:text-primary"
  )

  const children = (
    <>
      {unlocked && (
        <span
          className="text-tertiary shrink-0 text-sm leading-none select-none"
          aria-hidden="true"
        >
          ⠿
        </span>
      )}
      {archived ? (
        <span className="w-2 h-2 rounded-full bg-muted shrink-0" aria-hidden="true" />
      ) : (
        <PulseDot status={getHealthPulseDot(health)} size="sm" />
      )}
      <span className="flex-1 truncate text-sm font-semibold">{tracker.name}</span>
      <span className="font-mono text-xs tabular-nums text-tertiary shrink-0">
        {archived ? "Archived" : stat}
      </span>
      {!unlocked && (
        // biome-ignore lint/a11y/useSemanticElements: Star must be inside parent button for visual layout
        <span
          role="button"
          tabIndex={0}
          aria-pressed={tracker.isFavorite}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleFavorite(tracker.id, tracker.isFavorite)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(tracker.id, tracker.isFavorite)
            }
          }}
          className={clsx(
            "shrink-0 text-sm leading-none transition-all duration-150 cursor-pointer bg-transparent border-none p-0",
            tracker.isFavorite
              ? "text-warn opacity-100"
              : "text-muted opacity-0 group-hover:opacity-50 hover:opacity-100!"
          )}
          aria-label={tracker.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {tracker.isFavorite ? "★" : "☆"}
        </span>
      )}
    </>
  )

  return (
    <li ref={setNodeRef} style={dragStyle}>
      {unlocked ? (
        <button
          type="button"
          className={itemClasses}
          style={activeStyle}
          aria-current={isActive ? "page" : undefined}
          {...attributes}
          {...listeners}
        >
          {children}
        </button>
      ) : (
        <Link
          href={`/trackers/${tracker.id}`}
          prefetch
          className={itemClasses}
          style={activeStyle}
          aria-current={isActive ? "page" : undefined}
        >
          {children}
        </Link>
      )}
    </li>
  )
}

export { SortableTrackerItem }
