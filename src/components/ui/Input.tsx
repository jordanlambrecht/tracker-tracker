// src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes, useId } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <div className="flex flex-col gap-1.5 w-full">
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
          className={[
            "w-full font-mono text-sm text-primary cursor-pointer",
            "bg-control-bg border border-control-border rounded-md",
            "px-3 py-2 placeholder:text-muted",
            "transition-all duration-150",
            "focus:outline-none focus:border-accent focus:shadow-glow-sm",
            "focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            error ? "border-danger ring-1 ring-danger/30 focus:border-danger focus:shadow-glow-danger" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
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

export { Input }
export type { InputProps }
