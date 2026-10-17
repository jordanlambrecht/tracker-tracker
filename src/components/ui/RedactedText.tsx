// src/components/ui/RedactedText.tsx
"use client"

import clsx from "clsx"
import { Tooltip } from "@/components/ui/Tooltip"
import { redactedLength } from "@/lib/privacy"

export const REDACTED_NOTE = "Redacted, username privacy mode is enabled"

interface RedactedTextProps {
  value: string | null | undefined
  color?: string
  className?: string
  /**
   * The mosaic explains itself on hover. A caller whose own tooltip already
   * wraps this element passes false, or two popups open on the same spot.
   */
  tooltip?: boolean
}

// Renders either the real text or a visual redaction mosaic
function RedactedText({
  value,
  color = "var(--color-tertiary)",
  className,
  tooltip = true,
}: RedactedTextProps) {
  const charCount = redactedLength(value)

  // Not redacted
  if (charCount === null) {
    return <span className={className}>{value ?? "—"}</span>
  }

  // Generate deterministic-looking blocks from the character count
  const blocks: { id: string; opacity: number }[] = []
  for (let i = 0; i < charCount; i++) {
    const seed = i * 7 + 3
    blocks.push({ id: `r${charCount}-${seed}`, opacity: 0.3 + (seed % 5) * 0.15 })
  }

  const mosaic = (
    <span
      role="img"
      className={clsx("inline-flex items-center gap-px", className)}
      aria-label={`Redacted text, ${charCount} characters`}
    >
      {blocks.map((block) => (
        <span
          key={block.id}
          className="inline-block rounded-sm w-[0.55em] h-[1em]"
          style={{
            backgroundColor: color,
            opacity: block.opacity,
          }}
        />
      ))}
    </span>
  )

  if (!tooltip) return mosaic
  return <Tooltip content={REDACTED_NOTE}>{mosaic}</Tooltip>
}

export type { RedactedTextProps }
export { RedactedText }
