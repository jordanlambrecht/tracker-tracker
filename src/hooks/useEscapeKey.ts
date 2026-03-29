// src/hooks/useEscapeKey.ts

import { useEffect, useRef } from "react"

interface UseEscapeKeyOptions {
  /** Listen in capture phase (intercepts before children). Default: false */
  capture?: boolean
  /** Call e.stopPropagation() before handler. Default: false */
  stopPropagation?: boolean
}

/**
 * Registers a global keydown listener for Escape while `enabled` is true.
 * Handler is kept fresh via ref so callers don't need useCallback.
 */
function useEscapeKey(handler: () => void, enabled: boolean, options?: UseEscapeKeyOptions): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const capture = options?.capture ?? false
  const stop = options?.stopPropagation ?? false

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (stop) e.stopPropagation()
        handlerRef.current()
      }
    }
    document.addEventListener("keydown", onKeyDown, capture)
    return () => document.removeEventListener("keydown", onKeyDown, capture)
  }, [enabled, capture, stop])
}

export { useEscapeKey }
export type { UseEscapeKeyOptions }
