// src/hooks/usePatchSettings.ts

import { useCallback, useState } from "react"
import { extractApiError } from "@/lib/extract-api-error"

type PatchResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string }

interface UsePatchSettingsReturn {
  saving: boolean
  error: string | null
  success: boolean
  patch: (payload: Record<string, unknown>) => Promise<PatchResult>
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

  const patch = useCallback(async (payload: Record<string, unknown>): Promise<PatchResult> => {
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
      return { ok: true, data: result }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    saving,
    error,
    success,
    patch,
    clearError: useCallback(() => setError(null), []),
    clearSuccess: useCallback(() => setSuccess(false), []),
  }
}
