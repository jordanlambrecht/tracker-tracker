// src/components/ui/Dialog.tsx
"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import { type ReactNode, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { XIcon } from "@/components/ui/Icons"
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence"
import { useEscapeKey } from "@/hooks/useEscapeKey"

type DialogSize = "sm" | "md" | "lg" | "xl" | "full"

const SIZE_PRESETS: Record<DialogSize, { maxWidth: string; maxHeight: string }> = {
  sm: { maxWidth: "max-w-md", maxHeight: "70vh" },
  md: { maxWidth: "max-w-2xl", maxHeight: "85vh" },
  lg: { maxWidth: "max-w-4xl", maxHeight: "90vh" },
  xl: { maxWidth: "max-w-6xl", maxHeight: "90vh" },
  full: { maxWidth: "max-w-[95vw]", maxHeight: "95vh" },
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  ariaLabel?: string
  /** Preset size. Defaults to "md". Overridden by explicit maxWidth/maxHeight. */
  size?: DialogSize
  /** Tailwind max-width class (i.e "max-w-3xl"). Overrides size preset. */
  maxWidth?: string
  /** CSS max-height value (i.e "85vh"). Overrides size preset. */
  maxHeight?: string
  children: ReactNode
}

function Dialog({
  open,
  onClose,
  title,
  ariaLabel,
  size = "md",
  maxWidth,
  maxHeight,
  children,
}: DialogProps) {
  const preset = SIZE_PRESETS[size]
  const resolvedMaxWidth = maxWidth ?? preset.maxWidth
  const resolvedMaxHeight = maxHeight ?? preset.maxHeight
  const { mounted, visible, onTransitionEnd } = useAnimatedPresence(open, "opacity")
  useEscapeKey(onClose, mounted)

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
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
        style={{
          opacity: visible ? 1 : 0,
          transition: visible ? "opacity 200ms ease-out" : "opacity 150ms ease-in",
        }}
      />

      {/* Panel */}
      <div
        onTransitionEnd={onTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (titleIsString ? (title as string) : undefined)}
        className={clsx(
          "relative z-10 w-full flex flex-col bg-elevated nm-raised rounded-nm-xl overflow-hidden",
          resolvedMaxWidth
        )}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.95)",
          transition: visible
            ? "opacity 200ms ease-out, transform 200ms ease-out"
            : "opacity 150ms ease-in, transform 150ms ease-in",
          maxHeight: resolvedMaxHeight,
        }}
      >
        {/* Header */}
        {title !== undefined ? (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            {titleIsString ? <H2 className="uppercase tracking-wider">{title}</H2> : title}
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

export type { DialogProps, DialogSize }
export { Dialog }
