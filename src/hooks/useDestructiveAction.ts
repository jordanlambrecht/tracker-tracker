// src/hooks/useDestructiveAction.ts

"use client"

import { useCallback, useState } from "react"
import { extractApiError } from "@/lib/helpers"

interface UseDestructiveActionReturn {
  confirming: boolean
  open: () => void
  cancel: () => void
  password: string
  setPassword: (value: string) => void
  submitting: boolean
  error: string | null
  execute: () => Promise<void>
}

function useDestructiveAction(
  endpoint: string,
  onSuccess?: () => void
): UseDestructiveActionReturn {
  const [confirming, setConfirming] = useState(false)
  const [password, setPasswordRaw] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback(() => setConfirming(true), [])

  const cancel = useCallback(() => {
    setConfirming(false)
    setPasswordRaw("")
    setError(null)
  }, [])

  const setPassword = useCallback((value: string) => {
    setPasswordRaw(value)
    setError(null)
  }, [])

  const execute = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Action failed"))
      }
      cancel()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }, [endpoint, password, cancel, onSuccess])

  return { confirming, open, cancel, password, setPassword, submitting, error, execute }
}

export type { UseDestructiveActionReturn }
export { useDestructiveAction }
