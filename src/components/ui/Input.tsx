// src/components/ui/Input.tsx

import clsx from "clsx"
import { type InputHTMLAttributes, type Ref, useId } from "react"

type HintVariant = "default" | "danger"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  hintVariant?: HintVariant
  ref?: Ref<HTMLInputElement>
}

const HINT_COLORS: Record<HintVariant, string> = {
  default: "text-muted",
  danger: "text-danger/80",
}

function Input({
  label,
  error,
  hint,
  hintVariant = "default",
  className,
  id,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const describedBy = [error && `${inputId}-error`, hintId].filter(Boolean).join(" ") || undefined

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-sans font-medium text-secondary uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          "w-full font-mono text-sm text-primary",
          "bg-control-bg rounded-nm-md",
          "px-4 py-3 placeholder:text-muted",
          "transition-all duration-150",
          "nm-inset",
          "focus:outline-none focus:nm-inset",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "border-0",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-sans text-danger" role="alert">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={clsx("text-xs font-sans", HINT_COLORS[hintVariant])}>
          {hint}
        </p>
      )}
    </div>
  )
}

export type { InputProps }
export { Input }
