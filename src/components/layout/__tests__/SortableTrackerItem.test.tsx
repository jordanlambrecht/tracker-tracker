// src/components/layout/__tests__/SortableTrackerItem.test.tsx
//
// An archived row is not polled, so its dot is a still StatusDot: dimmed like
// every other still dot, never pulsing.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TrackerSummary } from "@/types/api"

// The drag handle needs a sortable context the sidebar provides.
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

import { SortableTrackerItem } from "@/components/layout/SortableTrackerItem"

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 42,
    name: "Aither",
    baseUrl: "https://aither.cc",
    registrySlug: "aither",
    linked: true,
    duplicateOf: null,
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    isFavorite: false,
    latestStats: null,
    ...overrides,
  } as TrackerSummary
}

describe("SortableTrackerItem", () => {
  it("shows an archived row's dot still and dimmed", () => {
    render(
      <SortableTrackerItem
        tracker={makeTracker({ isActive: false })}
        isActive={false}
        unlocked={false}
        statMode="ratio"
        onToggleFavorite={vi.fn()}
      />
    )

    const dot = screen.getByText("Aither").previousElementSibling
    expect(dot).toHaveClass("bg-muted", "opacity-50")
    expect(dot).toHaveAttribute("aria-hidden", "true")
    expect(dot).not.toHaveClass("animate-pulse-glow")
  })
})
