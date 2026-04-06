// src/components/ui/EmojiPickerPopover.tsx
"use client"

import type { EmojiClickData, EmojiStyle, PickerProps, Theme } from "emoji-picker-react"
import dynamic from "next/dynamic"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useEscapeKey } from "@/hooks/useEscapeKey"

const EmojiPicker = dynamic<PickerProps>(() => import("emoji-picker-react"), { ssr: false })

interface EmojiPickerPopoverProps {
  value: string
  onChange: (emoji: string) => void
  placeholder?: string
  disabled?: boolean
}

function EmojiPickerPopover({
  value,
  onChange,
  placeholder = "📦",
  disabled = false,
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left })
  }, [open])

  useEscapeKey(() => setOpen(false), open, { stopPropagation: true })

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (pickerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [open])

  return (
    <div ref={containerRef}>
      <div className="relative group">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="w-14 h-10 flex items-center justify-center text-lg bg-control-bg nm-interactive-inset cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-nm-sm"
          aria-label="Pick emoji"
        >
          {value || <span className="opacity-30">{placeholder}</span>}
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
            }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-elevated text-muted hover:text-danger text-3xs leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer rounded-nm-pill"
            aria-label="Clear emoji"
          >
            ✕
          </button>
        )}
      </div>

      {open &&
        createPortal(
          // biome-ignore lint/a11y/noStaticElementInteractions: onMouseDown prevents blur-close when clicking inside the picker
          <div
            ref={pickerRef}
            className="emoji-picker-wrapper fixed z-40 nm-raised-lg"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              theme={"dark" as Theme}
              emojiStyle={"apple" as EmojiStyle}
              width={320}
              height={380}
              lazyLoadEmojis
              searchPlaceholder="Search emojis…"
              previewConfig={{ showPreview: false }}
              onEmojiClick={(emojiData: EmojiClickData) => {
                onChange(emojiData.emoji)
                setOpen(false)
              }}
            />
          </div>,
          document.body
        )}
    </div>
  )
}

export type { EmojiPickerPopoverProps }
export { EmojiPickerPopover }
