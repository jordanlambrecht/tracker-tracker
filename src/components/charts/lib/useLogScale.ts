// src/components/charts/lib/useLogScale.ts
import { useState } from "react"
import { shouldUseLogScale } from "./theme"

/**
 * Encapsulates log-scale auto-detection and user toggle.
 * @param values - positive numeric values to check for log-scale worthiness
 * @param threeState - if true, cycles: auto → force-on → force-off → auto.
 *                     if false (default), cycles: auto → force-opposite → auto.
 */
export function useLogScale(
  values: number[],
  threeState = false
): {
  effectiveLog: boolean
  isAuto: boolean
  onToggle: () => void
} {
  const [override, setOverride] = useState<boolean | null>(null)
  const autoLog = shouldUseLogScale(values)
  const effectiveLog = override ?? autoLog

  return {
    effectiveLog,
    isAuto: override === null,
    onToggle: () => {
      if (threeState) {
        setOverride((prev) => {
          if (prev === null) return true
          if (prev === true) return false
          return null
        })
      } else {
        setOverride((prev) => (prev === null ? !autoLog : null))
      }
    },
  }
}
