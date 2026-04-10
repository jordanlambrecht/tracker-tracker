// src/components/tracker-detail/resolve-slots.ts
//
// Functions: resolveSlots

import type { ResolvedSlot, SlotCategory, SlotContext } from "@/types/slots"
import { SLOT_DEFINITIONS } from "./slot-registry"

export function resolveSlots(ctx: SlotContext): Map<SlotCategory, ResolvedSlot[]> {
  const grouped = new Map<SlotCategory, ResolvedSlot[]>()

  for (const slot of SLOT_DEFINITIONS) {
    const props = slot.resolve(ctx)
    if (props === null) continue

    const resolved: ResolvedSlot = {
      id: slot.id,
      category: slot.category,
      props: props as Record<string, unknown>,
      priority: slot.priority,
      span: slot.span ?? 1,
    }

    const list = grouped.get(slot.category) ?? []
    list.push(resolved)
    grouped.set(slot.category, list)
  }

  for (const [, slots] of grouped) {
    slots.sort((a, b) => a.priority - b.priority)
  }

  return grouped
}
