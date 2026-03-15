// src/components/tracker-detail/slots/SlotBadge.tsx
//
// Functions: SlotBadge

import type { ReactNode } from "react"
import type { BadgeVariant } from "@/components/ui/Badge"
import { Badge } from "@/components/ui/Badge"

export interface SlotBadgeProps {
  variant: BadgeVariant
  label?: string
  children?: ReactNode
}

export function SlotBadge({ variant, label, children }: SlotBadgeProps) {
  return <Badge variant={variant}>{children ?? label}</Badge>
}
