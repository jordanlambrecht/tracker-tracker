// src/components/ui/Checkbox.tsx
//
// Functions: Checkbox

"use client"

import type { ReactNode } from "react"
import { useId } from "react"
import clsx from "clsx"
import { CheckIcon } from "@/components/ui/Icons"

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  id?: string
  className?: string
  children?: ReactNode
}

function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className,
  children,
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <div className={clsx("flex items-start gap-3", className)}>
      <button
        type="button"
        id={checkboxId}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative shrink-0 w-5 h-5 mt-0.5 cursor-pointer",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
          "disabled:opacity-40 disabled:cursor-not-allowed rounded-nm-sm",
          checked ? "nm-raised-sm bg-accent-dim" : "nm-inset-sm bg-control-bg",
        )}
      >
        {checked && (
          <CheckIcon
            className="absolute inset-0 m-auto"
            width="12"
            height="12"
            stroke="var(--color-accent)"
          />
        )}
      </button>
      {(label || children) && (
        <label
          htmlFor={checkboxId}
          className="text-sm font-sans text-primary cursor-pointer select-none leading-relaxed"
        >
          {children ?? label}
        </label>
      )}
    </div>
  )
}

export { Checkbox }
export type { CheckboxProps }
