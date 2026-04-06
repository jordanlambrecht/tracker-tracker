// src/components/ui/Dialog.tsx
"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import { type ReactNode, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/Button"
import { XIcon } from "@/components/ui/Icons"
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence"

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
  /** Sticky footer content (action buttons, etc.) */
  footer?: ReactNode
  /** When true, disables escape, backdrop click, and close button */
  busy?: boolean
  /** If provided, the panel renders as a form with this submit handler */
  onSubmit?: () => void
  /** Extra attributes spread onto the form element when onSubmit is used */
  formProps?: React.HTMLAttributes<HTMLFormElement>
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
  footer,
  busy,
  onSubmit,
  formProps,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const preset = SIZE_PRESETS[size]
  const resolvedMaxWidth = maxWidth ?? preset.maxWidth
  const resolvedMaxHeight = maxHeight ?? preset.maxHeight
  const {
    mounted,
    visible,
    onTransitionEnd: baseOnTransitionEnd,
  } = useAnimatedPresence(open, "opacity")

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

  const titleIsString = typeof title === "string"
  const panelCls = clsx(
    "relative w-full flex flex-col bg-elevated nm-raised rounded-nm-xl overflow-hidden",
    resolvedMaxWidth
  )
  const panelStyle = {
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.95)",
    transition: visible
      ? "opacity 200ms ease-out, transform 200ms ease-out"
      : "opacity 150ms ease-in, transform 150ms ease-in",
    maxHeight: resolvedMaxHeight,
  }

  const header =
    title !== undefined ? (
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        {titleIsString ? <H2 className="uppercase tracking-wider">{title}</H2> : title}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          disabled={busy}
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
          onClick={handleClose}
          disabled={busy}
          aria-label="Close dialog"
          className="px-2 py-1.5"
        >
          <XIcon width="16" height="16" />
        </Button>
      </div>
    )

  const body = <div className="overflow-y-auto flex-1 p-6">{children}</div>
  const footerEl = footer ? (
    <div className="shrink-0 px-6 py-4 border-t border-border">{footer}</div>
  ) : null

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native dialog onCancel handles keyboard (Escape); onClick is backdrop-only dismiss
    <dialog
      ref={dialogRef}
      data-overlay
      data-visible={visible || undefined}
      className="fixed inset-0 m-0 p-4 w-screen h-screen bg-transparent flex items-center justify-center outline-none"
      aria-modal="true"
      aria-label={ariaLabel ?? (titleIsString ? (title as string) : undefined)}
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
          {...formProps}
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

export type { DialogProps, DialogSize }
export { Dialog }
