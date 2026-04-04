// src/components/dashboard/ChartCard.tsx

"use client"

import { ChevronUpIcon, EyeOffIcon } from "@icons"
import clsx from "clsx"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Card, ChartShimmer, Tooltip } from "@/components/ui"

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
  const [mounted, setMounted] = useState(false)

  // Defer initial mount until scrolled into view
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

  // Mount once visible, stay mounted. The collapse animation uses CSS
  // (grid-rows-[0fr] + opacity-0) to hide content — no need to destroy
  // and recreate ECharts instances on every expand/collapse cycle.
  useEffect(() => {
    if (visible && !collapsed && !mounted) {
      setMounted(true)
    }
  }, [visible, collapsed, mounted])

  return (
    <div ref={cardRef}>
      <Card
        className="relative flex flex-col gap-4"
        title={title}
        subtitle={description && !collapsed ? description : undefined}
      >
        {/* Collapse / Hide controls — absolute top-right over Card header */}
        <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
          <Tooltip content={collapsed ? "Expand" : "Collapse"}>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-7 h-7 flex items-center justify-center text-muted hover:text-secondary nm-interactive-inset cursor-pointer rounded-nm-sm"
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
          <Tooltip content="Hide chart">
            <button
              type="button"
              onClick={onHide}
              className="w-7 h-7 flex items-center justify-center text-muted hover:text-secondary nm-interactive-inset cursor-pointer rounded-nm-sm"
              aria-label="Hide chart"
            >
              <EyeOffIcon width="14" height="14" />
            </button>
          </Tooltip>
        </div>

        <div
          className={clsx(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          )}
        >
          <div
            className={clsx(
              "overflow-hidden p-6 -m-6 transition-opacity duration-150",
              collapsed ? "opacity-0" : "opacity-100"
            )}
          >
            {mounted ? children : visible && !collapsed && <ChartShimmer />}
          </div>
        </div>
      </Card>
    </div>
  )
}

export type { ChartCardProps }
export { ChartCard }
