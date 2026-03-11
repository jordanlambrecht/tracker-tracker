// src/components/ui/EmojiPickerPopover.tsx
//
// Functions: EmojiPickerPopover

"use client"

import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react"
import { useEffect, useRef, useState } from "react"
import { useClickOutside } from "@/hooks/useClickOutside"

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
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative group">
        <button
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

      {open && (
        <div className="absolute z-50 mt-2 left-0 nm-raised-lg">
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
        </div>
      )}
    </div>
  )
}

export { EmojiPickerPopover }
