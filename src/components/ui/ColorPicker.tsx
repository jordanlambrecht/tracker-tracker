// src/components/ui/ColorPicker.tsx

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HexColorPicker } from "react-colorful"
import { Button } from "./Button"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
}

function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState(value)
  const [hexInput, setHexInput] = useState(value)
  const ref = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Sync draft when value changes externally
  useEffect(() => {
    setDraft(value)
    setHexInput(value)
  }, [value])

  // Mount/unmount with animation
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
    }
  }, [open])

  function handleTransitionEnd() {
    if (!visible) {
      setMounted(false)
    }
  }

  const dismiss = useCallback(() => {
    setDraft(value)
    setHexInput(value)
    setOpen(false)
  }, [value])

  // Close on click outside — capture phase to beat dialog handlers
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        dismiss()
      }
    }
    document.addEventListener("mousedown", handleClick, true)
    return () => document.removeEventListener("mousedown", handleClick, true)
  }, [open, dismiss])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        dismiss()
      }
    }
    document.addEventListener("keydown", handleKey, true)
    return () => document.removeEventListener("keydown", handleKey, true)
  }, [open, dismiss])

  function handleDraftChange(color: string) {
    setDraft(color)
    setHexInput(color)
  }

  function handleHexInputChange(v: string) {
    setHexInput(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      setDraft(v)
    }
  }

  function handleConfirm() {
    onChange(draft)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
          {label}
        </span>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-10 w-14 nm-inset-sm cursor-pointer focus:outline-none rounded-nm-md border border-border"
          style={{ backgroundColor: value }}
          aria-label={`Color: ${value}`}
        />
        {mounted && (
          <div
            ref={popoverRef}
            onTransitionEnd={handleTransitionEnd}
            className="absolute bottom-full left-0 mb-2 z-40 nm-raised-sm p-3 bg-elevated rounded-nm-md flex flex-col gap-2 w-55"
            style={{
              transformOrigin: "bottom left",
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(4px)",
              transition: "opacity 150ms ease-out, transform 150ms ease-out",
              pointerEvents: visible ? "auto" : "none",
            }}
          >
            <div className="color-picker-wrapper">
              <HexColorPicker color={draft} onChange={handleDraftChange} />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-nm-sm nm-inset-sm shrink-0"
                style={{ backgroundColor: draft }}
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexInputChange(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono text-primary bg-control-bg nm-inset-sm focus:outline-none rounded-nm-sm border-0"
                maxLength={7}
                spellCheck={false}
              />
            </div>
            <Button type="button" size="sm" onClick={handleConfirm} className="w-full">
              Set Color
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export type { ColorPickerProps }
export { ColorPicker }
