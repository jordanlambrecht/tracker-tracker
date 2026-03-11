// src/components/dashboard/ChartCard.tsx
//
// Functions: ChartCard

"use client"

import type { ReactNode } from "react"
import { Card } from "@/components/ui/Card"
import { ChevronUpIcon, EyeOffIcon } from "@/components/ui/Icons"
import { H2 } from "@/components/ui/Typography"

interface ChartCardProps {
  title: string
  description?: string
  collapsed: boolean
  onToggleCollapse: () => void
  onHide: () => void
  children: ReactNode
}

function ChartCard({
  title,
  description,
  collapsed,
  onToggleCollapse,
  onHide,
  children,
}: ChartCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
            {title}
          </H2>
          {description && !collapsed && (
            <p className="text-xs font-mono text-tertiary">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-secondary transition-colors cursor-pointer rounded-nm-sm"
            aria-label={collapsed ? "Expand chart" : "Collapse chart"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <ChevronUpIcon
              width="14"
              height="14"
              className="transition-transform duration-200"
              style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
          {/* Hide */}
          <button
            type="button"
            onClick={onHide}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-secondary transition-colors cursor-pointer rounded-nm-sm"
            aria-label="Hide chart"
            title="Hide chart"
          >
            <EyeOffIcon width="14" height="14" />
          </button>
        </div>
      </div>

      {/* Animated content area using CSS grid trick */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden p-1 -m-1">{children}</div>
      </div>
    </Card>
  )
}

export { ChartCard }
export type { ChartCardProps }
