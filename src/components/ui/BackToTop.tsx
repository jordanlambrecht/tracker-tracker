// src/components/ui/BackToTop.tsx
//
// Functions: BackToTop

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronUpIcon } from "@/components/ui/Icons"

// Shadow keyframes: oklch values from globals.css nm-raised-* utilities.
// We lerp between these numerically for smooth continuous elevation.
const SHADOW_STEPS = [
  { offset: [-4, -4, 8], light: [33.24, 0.0268, 276.01], dark: [24.23, 0.0172, 280.05] },
  { offset: [-8, -8, 16], light: [34.45, 0.0283, 276.51], dark: [22.9, 0.0155, 279.49] },
  { offset: [-12, -12, 24], light: [36.85, 0.0312, 277.36], dark: [20.19, 0.0121, 277.81] },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function buildShadow(progress: number): string {
  if (progress <= 0) return "none"

  const p = Math.min(progress, 1)
  // Map 0→1 to index space across SHADOW_STEPS
  const scaled = p * (SHADOW_STEPS.length - 1)
  const lo = Math.floor(scaled)
  const hi = Math.min(lo + 1, SHADOW_STEPS.length - 1)
  const t = scaled - lo

  const a = SHADOW_STEPS[lo]
  const b = SHADOW_STEPS[hi]

  const ox = lerp(a.offset[0], b.offset[0], t)
  const oy = lerp(a.offset[1], b.offset[1], t)
  const blur = lerp(a.offset[2], b.offset[2], t)
  const lL = lerp(a.light[0], b.light[0], t)
  const lC = lerp(a.light[1], b.light[1], t)
  const lH = lerp(a.light[2], b.light[2], t)
  const dL = lerp(a.dark[0], b.dark[0], t)
  const dC = lerp(a.dark[1], b.dark[1], t)
  const dH = lerp(a.dark[2], b.dark[2], t)

  return `${ox.toFixed(1)}px ${oy.toFixed(1)}px ${blur.toFixed(1)}px oklch(${lL.toFixed(2)}% ${lC.toFixed(4)} ${lH.toFixed(2)}), ${(-ox).toFixed(1)}px ${(-oy).toFixed(1)}px ${blur.toFixed(1)}px oklch(${dL.toFixed(2)}% ${dC.toFixed(4)} ${dH.toFixed(2)})`
}

interface BackToTopProps {
  scrollRef: React.RefObject<HTMLElement | null>
}

export type { BackToTopProps }

export function BackToTop({ scrollRef }: BackToTopProps) {
  const [visible, setVisible] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const rafRef = useRef(0)

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      const maxScroll = scrollHeight - clientHeight
      const threshold = clientHeight * 0.015
      setVisible(scrollTop > threshold)
      setScrollProgress(maxScroll > 0 ? scrollTop / maxScroll : 0)
    })
  }, [scrollRef])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", handleScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [scrollRef, handleScroll])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [scrollRef])

  // Scale: 0.92 at top → 1.0 at bottom
  const scale = visible ? 0.92 + scrollProgress * 0.08 : 0.92

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-30 w-10 h-10 grid place-items-center rounded-full bg-elevated text-tertiary hover:text-primary cursor-pointer"
      style={{
        boxShadow: buildShadow(scrollProgress),
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? `scale(${scale.toFixed(3)})` : `translateY(8px) scale(0.92)`,
        transition: "opacity 300ms, transform 300ms, box-shadow 400ms ease-out",
      }}
      aria-label="Back to top"
    >
      <ChevronUpIcon width={14} height={14} />
    </button>
  )
}
