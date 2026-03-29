// src/components/ui/ColorPicker.tsx
"use client"

import { H2 } from "@typography"
import { useCallback, useRef, useState } from "react"
import { HexColorPicker } from "react-colorful"
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence"
import { useClickOutside } from "@/hooks/useClickOutside"
import { useEscapeKey } from "@/hooks/useEscapeKey"
import { isValidHex } from "@/lib/validators"
import { Button } from "./Button"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
}

function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [hexInput, setHexInput] = useState(value)
  const ref = useRef<HTMLDivElement>(null)
  const { mounted, visible, onTransitionEnd } = useAnimatedPresence(open)

  const dismiss = useCallback(() => {
    setDraft(value)
    setHexInput(value)
    setOpen(false)
  }, [value])

  useClickOutside(ref, dismiss, open)
  useEscapeKey(dismiss, open, { capture: true, stopPropagation: true })

  function handleDraftChange(color: string) {
    setDraft(color)
    setHexInput(color)
  }

  function handleHexInputChange(v: string) {
    setHexInput(v)
    if (isValidHex(v)) {
      setDraft(v)
    }
  }

  function handleConfirm() {
    onChange(draft)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <H2 className="uppercase tracking-wider">{label}</H2>}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => {
            if (!open) {
              setDraft(value)
              setHexInput(value)
            }
            setOpen((o) => !o)
          }}
          className="h-10 w-14 nm-inset-sm cursor-pointer focus:outline-none rounded-nm-md border border-border"
          style={{ backgroundColor: value }}
          aria-label={`Color: ${value}`}
        />
        {mounted && (
          <div
            onTransitionEnd={onTransitionEnd}
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
            <Button size="sm" onClick={handleConfirm} className="w-full" text="Set Color" />
          </div>
        )}
      </div>
    </div>
  )
}

export type { ColorPickerProps }
export { ColorPicker }
