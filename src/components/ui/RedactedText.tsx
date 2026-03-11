// src/components/ui/RedactedText.tsx
//
// Functions: RedactedText

"use client"

import clsx from "clsx"
import { redactedLength } from "@/lib/privacy"

interface RedactedTextProps {
  /** The raw value from the database — either real text or a "▓N" redacted marker */
  value: string | null | undefined
  /** Accent color for the redaction blocks */
  color?: string
  className?: string
}

/**
 * Renders either the real text or a visual redaction mosaic.
 * The mosaic consists of small blocks with varying opacity,
 * giving a "classified document" aesthetic. Block count is
 * derived from the original character length for visual consistency.
 */
function RedactedText({ value, color = "var(--color-tertiary)", className }: RedactedTextProps) {
  const charCount = redactedLength(value)

  // Not redacted — render the real value
  if (charCount === null) {
    return <span className={className}>{value ?? "—"}</span>
  }

  // Generate deterministic-looking blocks from the character count.
  // Each character maps to 1 block. We vary opacity using a simple
  // hash-like distribution so adjacent blocks look different.
  const blocks: number[] = []
  for (let i = 0; i < charCount; i++) {
    const opacity = 0.3 + ((i * 7 + 3) % 5) * 0.15
    blocks.push(opacity)
  }

  return (
    <span
      className={clsx("inline-flex items-center gap-px", className)}
      title="Redacted — username privacy mode is enabled"
      aria-label={`Redacted text, ${charCount} characters`}
    >
      {blocks.map((opacity, i) => (
        <span
          key={`block-${i}-${opacity}`}
          className="inline-block rounded-sm w-[0.55em] h-[1em]"
          style={{
            backgroundColor: color,
            opacity,
          }}
        />
      ))}
    </span>
  )
}

export { RedactedText }
export type { RedactedTextProps }
