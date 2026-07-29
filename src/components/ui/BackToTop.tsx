// src/components/ui/BackToTop.tsx
//
// Functions: BackToTop

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronUpIcon } from "@/components/ui/Icons"

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
      className="fixed bottom-6 right-6 z-30 w-10 h-10 grid place-items-center rounded-full bg-elevated text-tertiary hover:text-primary cursor-pointer nm-raised-sm hover:nm-raised"
      style={{
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
