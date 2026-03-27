// src/components/ui/RedactedText.tsx

"use client"

import clsx from "clsx"
import { Tooltip } from "@/components/ui/Tooltip"
import { redactedLength } from "@/lib/privacy"

interface RedactedTextProps {
  value: string | null | undefined
  color?: string
  className?: string
}

// Renders either the real text or a visual redaction mosaic
function RedactedText({ value, color = "var(--color-tertiary)", className }: RedactedTextProps) {
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

  return (
    <Tooltip content="Redacted — username privacy mode is enabled">
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
    </Tooltip>
  )
}

export type { RedactedTextProps }
export { RedactedText }
