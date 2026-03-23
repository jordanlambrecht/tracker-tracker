// src/components/ui/CollapsibleCard.tsx
//
// Functions: CollapsibleCard

"use client"

import { useRef, useState } from "react"
import { Card } from "@/components/ui/Card"
import { ChevronToggle } from "@/components/ui/ChevronToggle"

interface CollapsibleCardProps {
  /** Always-visible header content (left side — title, badges, meta) */
  header: React.ReactNode
  /** Optional content between header and collapsible body (i.e. uptime bars) — always visible */
  subheader?: React.ReactNode
  /** Trailing content in the header row before the chevron (i.e. type label) */
  trailing?: React.ReactNode
  /** Collapsible body content */
  children: React.ReactNode
  /** Controlled expanded state — if omitted, uses internal state */
  expanded?: boolean
  /** Controlled toggle callback */
  onToggle?: () => void
  /** Start expanded */
  defaultExpanded?: boolean
}

export function CollapsibleCard({
  header,
  subheader,
  trailing,
  children,
  expanded: controlledExpanded,
  onToggle,
  defaultExpanded = false,
}: CollapsibleCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isExpanded = controlledExpanded ?? internalExpanded
  const bodyRef = useRef<HTMLDivElement>(null)

  function handleToggle() {
    if (onToggle) {
      onToggle()
    } else {
      setInternalExpanded((e) => !e)
    }
  }

  return (
    <Card elevation="raised" className="flex flex-col gap-0 !p-0 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        className="flex items-center gap-3 px-5 py-4 w-full text-left cursor-pointer hover:bg-overlay transition-colors duration-100"
      >
        <div className="flex-1 min-w-0 flex items-center gap-3">{header}</div>
        {trailing && (
          <span className="text-xs font-mono text-tertiary shrink-0">{trailing}</span>
        )}
        <ChevronToggle expanded={isExpanded} variant="flip" className="text-tertiary text-sm" />
      </button>

      {subheader}

      <div
        ref={bodyRef}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border">
            {children}
          </div>
        </div>
      </div>
    </Card>
  )
}
