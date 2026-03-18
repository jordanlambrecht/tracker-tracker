// src/hooks/useClickOutside.ts
import { type RefObject, useEffect, useRef } from "react"

function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handlerRef.current()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [ref, enabled])
}

export { useClickOutside }
