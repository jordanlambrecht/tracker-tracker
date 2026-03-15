// src/components/ui/Toggle.tsx

"use client"

import clsx from "clsx"
import { useId } from "react"

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  description?: string
  id?: string
}

function Toggle({ label, checked, onChange, disabled = false, description, id }: ToggleProps) {
  const generatedId = useId()
  const toggleId = id ?? generatedId
  const descriptionId = description ? `${toggleId}-desc` : undefined

  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative shrink-0 w-11 h-6 cursor-pointer",
          "transition-all duration-200",
          "nm-inset-sm rounded-nm-pill",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          checked ? "bg-accent-dim" : "bg-control-bg",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 block w-5 h-5",
            "nm-raised-sm rounded-nm-pill",
            "transition-all duration-200",
            checked ? "left-[22px] bg-accent" : "left-0.5 bg-secondary",
          )}
          aria-hidden="true"
        />
      </button>
      <div className="flex flex-col gap-1 min-w-0">
        <label
          htmlFor={toggleId}
          className="text-sm font-sans font-medium text-primary cursor-pointer select-none leading-6"
        >
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-xs font-sans text-tertiary leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

export type { ToggleProps }
export { Toggle }
