// src/components/ui/Input.tsx

import clsx from "clsx"
import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react"
import type { DocsEntry } from "@/lib/constants"
import { InfoTip } from "./InfoTip"

type HintVariant = "default" | "danger"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Info icon beside the label, kept outside the label element. */
  tooltip?: ReactNode
  docs?: DocsEntry
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
  tooltip,
  docs,
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
        <div className="flex items-center gap-1">
          <label
            htmlFor={inputId}
            className="text-xs font-sans font-medium text-secondary uppercase tracking-wider"
          >
            {label}
          </label>
          {tooltip && <InfoTip content={tooltip} size="sm" docs={docs} />}
        </div>
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
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
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
