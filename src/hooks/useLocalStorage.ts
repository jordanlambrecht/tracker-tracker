// src/hooks/useLocalStorage.ts
import { useCallback, useEffect, useRef, useState } from "react"

function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const defaultValueRef = useRef(defaultValue)
  const [state, setState] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      setState(stored !== null ? (JSON.parse(stored) as T) : defaultValueRef.current)
    } catch {
      setState(defaultValueRef.current)
    }
  }, [key])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = value instanceof Function ? value(prev) : value
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {}
        return next
      })
    },
    [key]
  )

  return [state, setValue]
}

export { useLocalStorage }
