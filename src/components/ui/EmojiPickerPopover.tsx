// src/components/ui/EmojiPickerPopover.tsx
//
// Functions: EmojiPickerPopover

"use client"

import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

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

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleEvent(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") { e.stopPropagation(); setOpen(false) }
        return
      }
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (pickerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleEvent)
    document.addEventListener("keydown", handleEvent)
    return () => {
      document.removeEventListener("mousedown", handleEvent)
      document.removeEventListener("keydown", handleEvent)
    }
  }, [open])

  return (
    <div ref={containerRef}>
      <div className="relative group">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="w-14 h-10 flex items-center justify-center text-lg bg-control-bg nm-inset-sm cursor-pointer transition-all duration-150 hover:nm-raised disabled:opacity-40 disabled:cursor-not-allowed rounded-nm-sm"
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
            className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-elevated text-muted hover:text-danger text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer rounded-nm-pill"
            aria-label="Clear emoji"
          >
            ✕
          </button>
        )}
      </div>

      {open && createPortal(
        <div
          ref={pickerRef}
          className="emoji-picker-wrapper fixed z-50 nm-raised-lg"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <EmojiPicker
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.APPLE}
            width={320}
            height={380}
            lazyLoadEmojis
            searchPlaceholder="Search emojis…"
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emojiData) => {
              onChange(emojiData.emoji)
              setOpen(false)
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

export { EmojiPickerPopover }
