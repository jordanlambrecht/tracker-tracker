// src/hooks/useAnimatedPresence.ts

import { useEffect, useRef, useState } from "react"

/**
 * Manages the mount → double-rAF → visible → transitionend → unmount lifecycle
 * for CSS-animated overlays (Dialog, Sheet, ColorPicker, etc.).
 *
 * Returns `mounted` (controls DOM presence), `visible` (controls CSS classes),
 * and `onTransitionEnd` (attach to the animated element to trigger unmount).
 *
 * @param open      - Whether the overlay should be open
 * @param watchProperty - If set, only unmount when this CSS property finishes transitioning
 *                        (i.e "opacity", "transform"). Prevents premature unmount from
 *                        unrelated child transitions bubbling up.
 */
function useAnimatedPresence(open: boolean, watchProperty?: string) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const rafRef = useRef(0)

  useEffect(() => {
    if (open) {
      setMounted(true)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [open])

  function onTransitionEnd(e: { propertyName: string }) {
    if (watchProperty && e.propertyName !== watchProperty) return
    if (!visible) setMounted(false)
  }

  return { mounted, visible, onTransitionEnd }
}

export { useAnimatedPresence }
