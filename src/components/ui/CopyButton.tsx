// src/components/ui/CopyButton.tsx

"use client"

import { useCallback, useState } from "react"
import { CheckLargeIcon, CopyIcon } from "@/components/ui/Icons"

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}

function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        // clipboard unavailable. silently skip
      })
  }, [value])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className={
        className ??
        "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-sans font-medium text-tertiary hover:text-primary bg-elevated nm-raised-sm rounded-nm-sm transition-colors duration-150 cursor-pointer"
      }
    >
      {copied ? (
        <>
          <CheckLargeIcon width="12" height="12" className="text-success" />
          {label !== undefined ? "Copied" : null}
        </>
      ) : (
        <>
          <CopyIcon width="12" height="12" />
          {label !== undefined ? label : null}
        </>
      )}
    </button>
  )
}

export type { CopyButtonProps }
export { CopyButton }
