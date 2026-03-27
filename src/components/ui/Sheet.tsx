// src/components/ui/Sheet.tsx
//
// Functions: Sheet

"use client"

import clsx from "clsx"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mount → animate in, or animate out
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  // Unmount after exit transition completes
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || visible) return

    function handleEnd(e: TransitionEvent) {
      if (e.propertyName === "transform" && !visible) {
        setMounted(false)
      }
    }

    panel.addEventListener("transitionend", handleEnd)
    return () => panel.removeEventListener("transitionend", handleEnd)
  }, [visible])

  // Escape key
  useEffect(() => {
    if (!visible) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [visible, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        className={clsx(
          "absolute inset-0 backdrop-blur-sm bg-black/50 transition-opacity duration-300 ease-out cursor-default",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        tabIndex={-1}
        aria-label="Close"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={clsx(
          "relative w-full max-w-md h-full bg-elevated nm-raised-lg flex flex-col transition-transform duration-300 ease-out",
          className
        )}
        style={{
          borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Panel"}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
            <span className="text-sm font-sans font-semibold text-primary">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="text-tertiary hover:text-primary transition-colors cursor-pointer p-1 -m-1 rounded-nm-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 overflow-y-auto styled-scrollbar">{children}</div>
      </div>
    </div>
  )
}

export type { SheetProps }
export { Sheet }
