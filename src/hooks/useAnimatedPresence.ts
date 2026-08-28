// src/hooks/useAnimatedPresence.ts

import { useEffect, useRef, useState } from "react"

/**
 * Chrome suspends requestAnimationFrame entirely while a tab is hidden, so the
 * entry flip must not depend on rAF alone; the timer loses the race whenever
 * frames are actually running. Timers in hidden tabs are throttled to >= 1s,
 * which is still "eventually", not "never".
 */
const ENTRY_FALLBACK_MS = 150

/**
 * Longest exit transition among consumers (Sheet, 300ms) plus slack. A
 * transitionend can only arrive if a transition actually ran; when the entry
 * never completed (hidden tab) or the browser skipped the exit transition,
 * nothing fires, and without this fallback the overlay stayed mounted forever
 * as a ghost behind the page.
 */
const EXIT_FALLBACK_MS = 500

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
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Nobody can see an animation in a hidden tab, and Chrome's intensive
    // throttling can delay even the timer fallbacks there by up to a minute.
    // Jump straight to the end state instead.
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden"

    if (open) {
      setMounted(true)
      if (hidden) {
        setVisible(true)
        return
      }
      // Double rAF lets the mounted frame paint at the transition's start
      // state before flipping, so the entry animation actually plays.
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => setVisible(true))
      })
      fallbackRef.current = setTimeout(() => setVisible(true), ENTRY_FALLBACK_MS)
    } else {
      setVisible(false)
      if (hidden) {
        setMounted(false)
        return
      }
      // transitionend still unmounts first when it does arrive (see below);
      // this only catches the no-transition-ever-ran case.
      fallbackRef.current = setTimeout(() => setMounted(false), EXIT_FALLBACK_MS)
    }
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(fallbackRef.current)
    }
  }, [open])

  function onTransitionEnd(e: {
    propertyName: string
    target?: unknown
    currentTarget?: unknown
  }) {
    // A child's transition bubbling up must not unmount the overlay, even when
    // it transitions the watched property (i.e. a tooltip fading its opacity).
    if (e.target !== undefined && e.currentTarget !== undefined && e.target !== e.currentTarget) {
      return
    }
    if (watchProperty && e.propertyName !== watchProperty) return
    if (!visible) setMounted(false)
  }

  return { mounted, visible, onTransitionEnd }
}

export { useAnimatedPresence }
