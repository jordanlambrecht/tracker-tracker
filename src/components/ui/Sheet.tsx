// src/components/ui/Sheet.tsx

"use client"

import clsx from "clsx"
import { type ReactNode, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { XIcon } from "@/components/ui/Icons"
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence"
import { useEscapeKey } from "@/hooks/useEscapeKey"

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  footer?: ReactNode
  busy?: boolean
  onSubmit?: () => void
  children: ReactNode
  className?: string
}

function Sheet({ open, onClose, title, footer, busy, onSubmit, children, className }: SheetProps) {
  const { mounted, visible, onTransitionEnd } = useAnimatedPresence(open, "transform")

  const handleClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  useEscapeKey(handleClose, visible && !busy)

  // Body scroll lock
  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [mounted])

  if (!mounted) return null

  const panelCls = clsx(
    "relative w-full max-w-md h-full bg-elevated nm-raised-lg flex flex-col transition-transform duration-300 ease-out",
    className
  )
  const panelStyle = {
    borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
    transform: visible ? "translateX(0)" : "translateX(100%)",
  }

  const closeButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClose}
      disabled={busy}
      aria-label="Close panel"
      className="px-2 py-1.5"
    >
      <XIcon width="16" height="16" />
    </Button>
  )

  const header = title ? (
    <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
      <span className="text-sm font-sans font-semibold text-primary">{title}</span>
      {closeButton}
    </div>
  ) : (
    <div className="absolute top-3 right-3 z-10">{closeButton}</div>
  )

  const body = <div className="flex-1 overflow-y-auto styled-scrollbar">{children}</div>
  const footerEl = footer ? (
    <div className="shrink-0 px-6 py-4 border-t border-border">{footer}</div>
  ) : null

  const panelContent = (
    <>
      {header}
      {body}
      {footerEl}
    </>
  )

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Panel"}
    >
      {/* Backdrop */}
      <button
        type="button"
        data-overlay
        data-visible={visible || undefined}
        className={clsx(
          "absolute inset-0 bg-black/60 transition-opacity duration-200 ease-out cursor-default",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
        tabIndex={-1}
        aria-label="Close"
      />

      {/* Panel */}
      {onSubmit ? (
        <form
          onTransitionEnd={onTransitionEnd}
          className={panelCls}
          style={panelStyle}
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          {panelContent}
        </form>
      ) : (
        <div onTransitionEnd={onTransitionEnd} className={panelCls} style={panelStyle}>
          {panelContent}
        </div>
      )}
    </div>
  )
}

export type { SheetProps }
export { Sheet }
