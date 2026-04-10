// src/components/ui/AreaInput.tsx

import clsx from "clsx"
import { type Ref, type TextareaHTMLAttributes, useId } from "react"

interface AreaInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

function AreaInput({ label, error, className, id, ref, ...props }: AreaInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

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
      <textarea
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
          "border-0 resize-y",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-sans text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export type { AreaInputProps }
export { AreaInput }
