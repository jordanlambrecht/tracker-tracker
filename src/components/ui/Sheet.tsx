// src/components/ui/Sheet.tsx

"use client"

import clsx from "clsx"
import { type ReactNode, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/Button"
import { XIcon } from "@/components/ui/Icons"
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence"

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Sticky footer content (action buttons, etc.) */
  footer?: ReactNode
  /** When true, disables escape, backdrop click, and close button */
  busy?: boolean
  /** If provided, the panel renders as a form with this submit handler */
  onSubmit?: () => void
  children: ReactNode
  className?: string
}

function Sheet({ open, onClose, title, footer, busy, onSubmit, children, className }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const {
    mounted,
    visible,
    onTransitionEnd: baseOnTransitionEnd,
  } = useAnimatedPresence(open, "transform")

  // Wrap transition end to close native dialog before unmount (restores focus to trigger)
  const onTransitionEnd = useCallback(
    (e: { propertyName: string }) => {
      if (!visible) dialogRef.current?.close()
      baseOnTransitionEnd(e)
    },
    [visible, baseOnTransitionEnd]
  )

  // Sync native dialog with mount lifecycle
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && mounted && !dialog.open) {
      dialog.showModal()
    }
  }, [mounted])

  // Body scroll lock — native dialog does not prevent background scrolling
  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [mounted])

  const handleClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  if (!mounted) return null

  const panelCls = clsx(
    "absolute right-0 top-0 w-full max-w-md h-full bg-elevated nm-raised-lg flex flex-col transition-transform duration-300 ease-out",
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

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native dialog onCancel handles keyboard (Escape); onClick is backdrop-only dismiss
    <dialog
      ref={dialogRef}
      data-overlay
      data-visible={visible || undefined}
      className="fixed inset-0 m-0 p-0 w-screen h-screen bg-transparent flex justify-end outline-none"
      aria-modal="true"
      aria-label={title ?? "Panel"}
      onCancel={(e) => {
        e.preventDefault()
        handleClose()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
    >
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
          {header}
          {body}
          {footerEl}
        </form>
      ) : (
        <div onTransitionEnd={onTransitionEnd} className={panelCls} style={panelStyle}>
          {header}
          {body}
          {footerEl}
        </div>
      )}
    </dialog>
  )
}

export type { SheetProps }
export { Sheet }
