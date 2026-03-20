// src/components/ui/Dialog.tsx
//
// Functions: Dialog

"use client"

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { XIcon } from "@/components/ui/Icons"

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  ariaLabel?: string
  maxWidth?: string
  maxHeight?: string
  children: ReactNode
}

function Dialog({
  open,
  onClose,
  title,
  ariaLabel,
  maxWidth = "max-w-2xl",
  maxHeight = "90vh",
  children,
}: DialogProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mount → animate in, or animate out → unmount
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  // Unmount after exit transition completes (wait for opacity/transform on panel)
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || visible) return

    function handleEnd(e: TransitionEvent) {
      if (e.propertyName === "opacity" && !visible) {
        setMounted(false)
      }
    }

    panel.addEventListener("transitionend", handleEnd)
    return () => panel.removeEventListener("transitionend", handleEnd)
  }, [visible])

  // Escape key
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!mounted) return
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [mounted, handleKey])

  // Body scroll lock
  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [mounted])

  if (!mounted) return null

  const titleIsString = typeof title === "string"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        style={{
          opacity: visible ? 1 : 0,
          transition: visible ? "opacity 200ms ease-out" : "opacity 150ms ease-in",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (titleIsString ? (title as string) : undefined)}
        className={[
          "relative z-10 w-full flex flex-col bg-elevated nm-raised rounded-nm-xl overflow-hidden",
          maxWidth,
        ].join(" ")}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.95)",
          transition: visible
            ? "opacity 200ms ease-out, transform 200ms ease-out"
            : "opacity 150ms ease-in, transform 150ms ease-in",
          maxHeight: maxHeight,
        }}
      >
        {/* Header */}
        {title !== undefined ? (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            {titleIsString ? (
              <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
                {title}
              </span>
            ) : (
              title
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close dialog"
              className="px-2 py-1.5"
            >
              <XIcon width="16" height="16" />
            </Button>
          </div>
        ) : (
          <div className="absolute top-3 right-3 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close dialog"
              className="px-2 py-1.5"
            >
              <XIcon width="16" height="16" />
            </Button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

export type { DialogProps }
export { Dialog }
