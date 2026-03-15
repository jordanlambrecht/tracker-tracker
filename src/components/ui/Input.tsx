// src/components/ui/Input.tsx

import clsx from "clsx"
import { forwardRef, type InputHTMLAttributes, useId } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
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
            className,
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs font-sans text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export type { InputProps }
export { Input }
