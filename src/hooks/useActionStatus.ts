// src/hooks/useActionStatus.ts

import { useCallback, useRef, useState } from "react"

type ActionStatus = "idle" | "testing" | "success" | "failed"

interface UseActionStatusOptions {
  autoResetMs?: number | false
}

interface UseActionStatusReturn {
  status: ActionStatus
  error: string | null
  execute: (fn: () => Promise<void>) => Promise<void>
  reset: () => void
}

/**
 * Manages a 4-state action lifecycle: idle → testing → success|failed.
 * The caller provides an async function to `execute`; if it throws,
 * the error message is captured and status becomes "failed".
 * On success, auto-resets to "idle" after `autoResetMs` (default 3000).
 * Pass `autoResetMs: false` to stay on "success" until manually reset.
 */
export function useActionStatus(opts?: UseActionStatusOptions): UseActionStatusReturn {
  const [status, setStatus] = useState<ActionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const autoResetMs = opts?.autoResetMs ?? 3000
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const execute = useCallback(
    async (fn: () => Promise<void>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setStatus("testing")
      setError(null)
      try {
        await fn()
        setStatus("success")
        if (autoResetMs !== false) {
          timerRef.current = setTimeout(() => setStatus("idle"), autoResetMs)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setStatus("failed")
      }
    },
    [autoResetMs]
  )

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus("idle")
    setError(null)
  }, [])

  return { status, error, execute, reset }
}

export type { ActionStatus, UseActionStatusOptions, UseActionStatusReturn }
