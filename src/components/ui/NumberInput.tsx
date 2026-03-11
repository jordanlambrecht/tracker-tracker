// src/components/ui/NumberInput.tsx
//
// Functions: NumberInput

"use client"

import clsx from "clsx"
import { useId } from "react"
import { ChevronDownSmallIcon, ChevronUpSmallIcon } from "@/components/ui/Icons"

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  label?: string
  id?: string
  className?: string
}

function NumberInput({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  disabled = false,
  label,
  id,
  className,
}: NumberInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  function clamp(v: number) {
    return Math.min(max, Math.max(min, v))
  }

  function handleChange(raw: string) {
    const parsed = parseInt(raw, 10)
    if (!Number.isNaN(parsed)) {
      onChange(clamp(parsed))
    }
  }

  return (
    <div className={clsx("inline-flex flex-col gap-1", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-sans font-medium text-secondary uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <div
        className="inline-flex items-stretch nm-inset-sm overflow-hidden rounded-nm-sm"
      >
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          role="spinbutton"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={clsx(
            "w-12 text-center font-mono text-xs text-primary",
            "bg-control-bg py-2 px-1",
            "border-0 focus:outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
        />
        <div className="flex flex-col border-l border-border">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || value >= max}
            onClick={() => onChange(clamp(value + step))}
            className={clsx(
              "flex items-center justify-center w-7 flex-1",
              "bg-control-bg text-tertiary",
              "hover:text-primary hover:bg-overlay",
              "transition-colors duration-100 cursor-pointer",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              "border-b border-border",
            )}
            aria-label="Increase"
          >
            <ChevronUpSmallIcon width="10" height="6" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || value <= min}
            onClick={() => onChange(clamp(value - step))}
            className={clsx(
              "flex items-center justify-center w-7 flex-1",
              "bg-control-bg text-tertiary",
              "hover:text-primary hover:bg-overlay",
              "transition-colors duration-100 cursor-pointer",
              "disabled:opacity-30 disabled:cursor-not-allowed",
            )}
            aria-label="Decrease"
          >
            <ChevronDownSmallIcon width="10" height="6" />
          </button>
        </div>
      </div>
    </div>
  )
}

export { NumberInput }
export type { NumberInputProps }
