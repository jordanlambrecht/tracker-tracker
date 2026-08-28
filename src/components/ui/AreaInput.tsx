// src/components/ui/AreaInput.tsx

import clsx from "clsx"
import { type ReactNode, type Ref, type TextareaHTMLAttributes, useId } from "react"
import type { DocsEntry } from "@/lib/constants"
import { InfoTip } from "./InfoTip"

interface AreaInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  /** Info icon beside the label, kept outside the label element. */
  tooltip?: ReactNode
  docs?: DocsEntry
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

function AreaInput({ label, tooltip, docs, error, className, id, ref, ...props }: AreaInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

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
      <textarea
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
