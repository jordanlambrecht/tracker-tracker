// src/hooks/useSetToggle.ts

"use client"

import { useCallback, useState } from "react"

interface UseSetToggleReturn<T> {
  set: Set<T>
  toggle: (value: T) => void
  has: (value: T) => boolean
  reset: (values: Iterable<T>) => void
  size: number
}

function useSetToggle<T>(initial: Iterable<T>): UseSetToggleReturn<T> {
  const [set, setSet] = useState(() => new Set(initial))

  const toggle = useCallback((value: T) => {
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }, [])

  const reset = useCallback((values: Iterable<T>) => setSet(new Set(values)), [])

  return {
    set,
    toggle,
    has: useCallback((value: T) => set.has(value), [set]),
    reset,
    size: set.size,
  }
}

export type { UseSetToggleReturn }
export { useSetToggle }
