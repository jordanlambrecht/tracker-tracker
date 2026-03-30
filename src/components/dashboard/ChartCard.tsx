// src/components/dashboard/ChartCard.tsx

"use client"

import { H3 } from "@typography"
import clsx from "clsx"
import { type ReactNode, useEffect, useRef, useState } from "react"
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

  // Keep children mounted during collapse animation, unmount after it finishes
  const shouldMount = visible && !collapsed
  useEffect(() => {
    if (shouldMount) {
      setMounted(true)
    } else if (visible) {
      const timer = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(timer)
    }
  }, [shouldMount, visible])

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
            {/* Hide */}
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
            {mounted && children}
          </div>
        </div>
      </Card>
    </div>
  )
}

export type { ChartCardProps }
export { ChartCard }
