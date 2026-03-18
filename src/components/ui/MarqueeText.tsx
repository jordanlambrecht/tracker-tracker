// src/components/ui/MarqueeText.tsx

"use client"

import clsx from "clsx"
import { type ReactNode, useEffect, useRef, useState } from "react"

interface MarqueeTextProps {
  children: ReactNode
  className?: string
  speed?: number
}

function MarqueeText({ children, className = "", speed = 40 }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [duration, setDuration] = useState(12)

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs don't need to be deps
  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    function check() {
      if (!container || !text) return
      const isOverflowing = text.scrollWidth > container.clientWidth
      setOverflows(isOverflowing)
      if (isOverflowing) {
        setDuration(text.scrollWidth / speed)
      }
    }

    check()

    const ro = new ResizeObserver(check)
    ro.observe(container)
    return () => ro.disconnect()
  }, [speed, children])

  return (
    <div ref={containerRef} className={clsx("overflow-hidden whitespace-nowrap", className)}>
      <span
        ref={textRef}
        className={clsx("inline-block", overflows && "marquee-scroll")}
        style={overflows ? { animationDuration: `${duration}s` } : undefined}
      >
        {children}
        {overflows && (
          <span className="px-8" aria-hidden="true">
            ·
          </span>
        )}
        {overflows && children}
      </span>
    </div>
  )
}

export type { MarqueeTextProps }
export { MarqueeText }
