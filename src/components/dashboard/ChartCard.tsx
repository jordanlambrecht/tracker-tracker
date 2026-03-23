// src/components/dashboard/ChartCard.tsx
//
// Functions: ChartCard

"use client"

import { H3 } from "@typography"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/Card"
import { ChevronUpIcon, EyeOffIcon } from "@/components/ui/Icons"
import { Tooltip } from "@/components/ui/Tooltip"

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
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [shouldMount, setShouldMount] = useState(false)

  // Lazy-load: only mount chart content when card scrolls into view
  useEffect(() => {
    const el = cardRef.current
    if (!el || visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!collapsed && visible) setShouldMount(true)
  }, [collapsed, visible])

  return (
    <div ref={cardRef}>
      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <H3 className="uppercase tracking-wider text-secondary">{title}</H3>
            {description && !collapsed && (
              <p className="text-xs font-mono text-tertiary">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Collapse toggle */}
            <Tooltip content={collapsed ? "Expand" : "Collapse"}>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="w-7 h-7 flex items-center justify-center text-muted hover:text-secondary hover:bg-overlay transition-colors cursor-pointer rounded-nm-sm"
                aria-label={collapsed ? "Expand chart" : "Collapse chart"}
              >
                <ChevronUpIcon
                  width="14"
                  height="14"
                  className="transition-transform duration-200"
                  style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
            </Tooltip>
            {/* Hide */}
            <Tooltip content="Hide chart">
              <button
                type="button"
                onClick={onHide}
                className="w-7 h-7 flex items-center justify-center text-muted hover:text-secondary hover:bg-overlay transition-colors cursor-pointer rounded-nm-sm"
                aria-label="Hide chart"
              >
                <EyeOffIcon width="14" height="14" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Animated content area using CSS grid trick */}
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}
        >
          {/* p-6 -m-6: overflow-hidden is required for grid collapse animation,
            but clips neumorphic shadows (nm-raised reaches ~24px). The padding
            pushes the clip boundary out; the negative margin cancels layout shift. */}
          <div className="overflow-hidden p-6 -m-6">{shouldMount && children}</div>
        </div>
      </Card>
    </div>
  )
}

export type { ChartCardProps }
export { ChartCard }
