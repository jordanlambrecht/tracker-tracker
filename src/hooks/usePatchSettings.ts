// src/hooks/usePatchSettings.ts
//
// Functions: usePatchSettings

import { useCallback, useState } from "react"
import { extractApiError } from "@/lib/client-helpers"

interface UsePatchSettingsReturn {
  saving: boolean
  error: string | null
  success: boolean
  patch: (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  clearError: () => void
  clearSuccess: () => void
}

/**
 * Hook for PATCH /api/settings with loading, error, and success state management.
 * Returns the parsed response on success, null on failure.
 */
export function usePatchSettings(): UsePatchSettingsReturn {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const patch = useCallback(
    async (payload: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      setSaving(true)
      setError(null)
      setSuccess(false)
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          throw new Error(await extractApiError(res, "Save failed"))
        }
        const result = await res.json()
        setSuccess(true)
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error")
        return null
      } finally {
        setSaving(false)
      }
    },
    []
  )

  return {
    saving,
    error,
    success,
    patch,
    clearError: useCallback(() => setError(null), []),
    clearSuccess: useCallback(() => setSuccess(false), []),
  }
}
