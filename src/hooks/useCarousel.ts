// src/hooks/useCarousel.ts

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseCarouselOptions {
  itemCount: number
  autoRotateMs?: number
  swipeThreshold?: number
}

interface UseCarouselReturn {
  activeIndex: number
  direction: "left" | "right"
  animating: boolean
  goTo: (index: number) => void
  onPointerDownCapture: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

function useCarousel({
  itemCount,
  autoRotateMs,
  swipeThreshold = 40,
}: UseCarouselOptions): UseCarouselReturn {
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState<"left" | "right">("left")
  const [animating, setAnimating] = useState(false)

  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const pointerDown = useRef(false)

  // Clamp activeIndex when item count shrinks
  useEffect(() => {
    if (itemCount > 0 && activeIndex >= itemCount) {
      setActiveIndex(0)
    }
  }, [itemCount, activeIndex])

  const goTo = useCallback(
    (next: number) => {
      setActiveIndex((prev) => {
        setDirection(next > prev || (prev === itemCount - 1 && next === 0) ? "left" : "right")
        setAnimating(true)
        return next
      })
    },
    [itemCount]
  )

  // Clear animation flag after transition
  useEffect(() => {
    if (!animating) return
    const t = setTimeout(() => setAnimating(false), 300)
    return () => clearTimeout(t)
  }, [animating])

  // Auto-rotate
  useEffect(() => {
    if (!autoRotateMs || itemCount <= 1) return
    const timer = setInterval(() => {
      goTo((activeIndex + 1) % itemCount)
    }, autoRotateMs)
    return () => clearInterval(timer)
  }, [itemCount, activeIndex, goTo, autoRotateMs])

  // Swipe gesture handlers
  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointerDown.current = true
    swipeStartX.current = e.clientX
    swipeStartY.current = e.clientY
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerDown.current) return
      pointerDown.current = false
      if (itemCount <= 1) return
      const dx = e.clientX - swipeStartX.current
      const dy = e.clientY - swipeStartY.current
      if (Math.abs(dx) < swipeThreshold || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) goTo((activeIndex + 1) % itemCount)
      else goTo((activeIndex - 1 + itemCount) % itemCount)
    },
    [itemCount, activeIndex, goTo, swipeThreshold]
  )

  return { activeIndex, direction, animating, goTo, onPointerDownCapture, onPointerUp }
}

export type { UseCarouselOptions, UseCarouselReturn }
export { useCarousel }
