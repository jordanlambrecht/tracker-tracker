// src/hooks/useAnimatedPresence.test.ts

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAnimatedPresence } from "./useAnimatedPresence"

// Chrome suspends requestAnimationFrame entirely in hidden tabs. These tests
// simulate that by stubbing rAF to never invoke its callback: the regression
// this guards against is the overlay wedging at its start state (visible never
// flipping) and, on close, staying mounted forever because no transition ever
// ran and so no transitionend could arrive.

describe("useAnimatedPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function suspendRaf() {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1)
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {})
  }

  it("becomes visible via the timer fallback when rAF is suspended", () => {
    suspendRaf()
    const { result } = renderHook(() => useAnimatedPresence(true, "opacity"))

    expect(result.current.mounted).toBe(true)
    expect(result.current.visible).toBe(false)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.visible).toBe(true)
  })

  it("still becomes visible through the rAF path when frames run", () => {
    // rAF fires ~16ms later, well before the timer fallback.
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 16)
      return 1
    })
    const { result } = renderHook(() => useAnimatedPresence(true, "opacity"))

    act(() => {
      vi.advanceTimersByTime(40)
    })
    expect(result.current.visible).toBe(true)
  })

  it("unmounts via the timer fallback when no transition ever runs", () => {
    suspendRaf()
    const { result, rerender } = renderHook(({ open }) => useAnimatedPresence(open, "opacity"), {
      initialProps: { open: true },
    })

    // Close before the entry ever completed: nothing transitions, so no
    // transitionend can arrive.
    rerender({ open: false })
    expect(result.current.mounted).toBe(true)

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current.mounted).toBe(false)
  })

  it("unmounts promptly on transitionend without waiting for the fallback", () => {
    suspendRaf()
    const { result, rerender } = renderHook(({ open }) => useAnimatedPresence(open, "opacity"), {
      initialProps: { open: true },
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.visible).toBe(true)

    rerender({ open: false })
    const el = {}
    act(() => {
      result.current.onTransitionEnd({ propertyName: "opacity", target: el, currentTarget: el })
    })
    expect(result.current.mounted).toBe(false)
  })

  it("ignores a child's bubbled transition even on the watched property", () => {
    suspendRaf()
    const { result, rerender } = renderHook(({ open }) => useAnimatedPresence(open, "opacity"), {
      initialProps: { open: true },
    })
    rerender({ open: false })

    act(() => {
      result.current.onTransitionEnd({
        propertyName: "opacity",
        target: { child: true },
        currentTarget: { panel: true },
      })
    })
    expect(result.current.mounted).toBe(true)
  })

  it("ignores unwatched properties as before", () => {
    suspendRaf()
    const { result, rerender } = renderHook(({ open }) => useAnimatedPresence(open, "opacity"), {
      initialProps: { open: true },
    })
    rerender({ open: false })

    const el = {}
    act(() => {
      result.current.onTransitionEnd({ propertyName: "transform", target: el, currentTarget: el })
    })
    expect(result.current.mounted).toBe(true)
  })

  it("skips the animation entirely in a hidden tab and shows immediately", () => {
    suspendRaf()
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
    const { result } = renderHook(() => useAnimatedPresence(true, "opacity"))

    expect(result.current.mounted).toBe(true)
    expect(result.current.visible).toBe(true)
  })

  it("unmounts immediately on close in a hidden tab", () => {
    suspendRaf()
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
    const { result, rerender } = renderHook(({ open }) => useAnimatedPresence(open, "opacity"), {
      initialProps: { open: true },
    })

    rerender({ open: false })
    expect(result.current.mounted).toBe(false)
  })

  it("a reopen during the exit window cancels the pending unmount", () => {
    suspendRaf()
    const { result, rerender } = renderHook(({ open }) => useAnimatedPresence(open, "opacity"), {
      initialProps: { open: true },
    })
    rerender({ open: false })
    rerender({ open: true })

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current.mounted).toBe(true)
    expect(result.current.visible).toBe(true)
  })
})
