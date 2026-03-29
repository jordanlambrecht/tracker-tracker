// src/components/ui/LazySection.tsx

"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"

interface LazySectionProps {
  children: ReactNode
  minHeight?: number
}

// Uses IntersectionObserver to delay rendering of children until the element scrolls into view

function LazySection({ children, minHeight = 200 }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
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

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : null}
    </div>
  )
}

export type { LazySectionProps }
export { LazySection }
