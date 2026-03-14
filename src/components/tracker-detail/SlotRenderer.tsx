// src/components/tracker-detail/SlotRenderer.tsx
//
// Functions: SlotRenderer
//
// Renders a list of resolved slots.
// - Non-bare mode: wraps slots in a container div with the given className.
//   Used for progress slots (className="flex flex-col gap-10").
// - Bare mode: returns slot elements as a fragment, with no wrapper.
//   Parent grid (AnalyticsTab) handles all explicit positioning via getCardClasses.

"use client"

import type { ResolvedSlot } from "@/lib/slot-types"
import { renderSlotElement } from "./slot-registry"

interface SlotRendererProps {
  slots: ResolvedSlot[]
  className?: string
  bare?: boolean
}

export function SlotRenderer({ slots, className, bare }: SlotRendererProps) {
  if (slots.length === 0) return null

  const items = slots.map((slot) => {
    const el = renderSlotElement(slot)
    if (!el) return null
    return <div key={slot.id}>{el}</div>
  })

  if (bare) return <>{items}</>

  return <div className={className}>{items}</div>
}
