// src/components/ui/Checkbox.tsx
"use client"

import clsx from "clsx"
import type { ReactNode } from "react"
import { useId } from "react"
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
    <label
      htmlFor={checkboxId}
      className={clsx(
        "flex items-start gap-3 cursor-pointer select-none",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      <span className="relative shrink-0 w-5 h-5 mt-0.5">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={clsx(
            "absolute inset-0 block rounded-nm-sm transition-all duration-150",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-control-focus) peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-base",
            checked ? "nm-raised-sm bg-accent-dim" : "nm-inset-sm bg-control-bg"
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
        </span>
      </span>
      {(label || children) && (
        <span className="text-sm font-sans text-primary leading-relaxed">{children ?? label}</span>
      )}
    </label>
  )
}

export type { CheckboxProps }
export { Checkbox }
