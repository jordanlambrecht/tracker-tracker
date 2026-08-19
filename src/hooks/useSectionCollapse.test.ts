// src/hooks/useSectionCollapse.test.ts

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { useSectionCollapse } from "./useSectionCollapse"

describe("useSectionCollapse", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("hydrates from empty storage with nothing collapsed", async () => {
    const { result } = renderHook(() => useSectionCollapse())
    await act(async () => {})

    expect(result.current.hydrated).toBe(true)
    expect(result.current.isCollapsed("trackers")).toBe(false)
  })

  it("round-trips a toggle: collapses then expands the same id", async () => {
    const { result } = renderHook(() => useSectionCollapse())
    await act(async () => {})

    act(() => {
      result.current.toggle("trackers")
    })
    expect(result.current.isCollapsed("trackers")).toBe(true)

    act(() => {
      result.current.toggle("trackers")
    })
    expect(result.current.isCollapsed("trackers")).toBe(false)
  })

  it("persists collapse state across remount", async () => {
    const first = renderHook(() => useSectionCollapse())
    await act(async () => {})

    act(() => {
      first.result.current.toggle("leaderboard")
    })
    expect(first.result.current.isCollapsed("leaderboard")).toBe(true)
    first.unmount()

    const second = renderHook(() => useSectionCollapse())
    await act(async () => {})
    expect(second.result.current.hydrated).toBe(true)
    expect(second.result.current.isCollapsed("leaderboard")).toBe(true)
  })

  it("persists several different ids toggled in sequence on one shared instance", async () => {
    // Mirrors real usage: DashboardClient owns a single useSectionCollapse
    // instance and drives every section's toggle from it, precisely so
    // sibling sections can't clobber each other's writes.
    const first = renderHook(() => useSectionCollapse())
    await act(async () => {})

    act(() => {
      first.result.current.toggle("trackers")
    })
    act(() => {
      first.result.current.toggle("login-timers")
    })
    act(() => {
      first.result.current.toggle("leaderboard")
    })

    expect(first.result.current.isCollapsed("trackers")).toBe(true)
    expect(first.result.current.isCollapsed("login-timers")).toBe(true)
    expect(first.result.current.isCollapsed("leaderboard")).toBe(true)
    first.unmount()

    const second = renderHook(() => useSectionCollapse())
    await act(async () => {})

    expect(second.result.current.isCollapsed("trackers")).toBe(true)
    expect(second.result.current.isCollapsed("login-timers")).toBe(true)
    expect(second.result.current.isCollapsed("leaderboard")).toBe(true)
    expect(second.result.current.isCollapsed("ecosystem-stats")).toBe(false)
  })

  it("ignores an unknown/removed section id found in storage without breaking other ids", async () => {
    localStorage.setItem(
      STORAGE_KEYS.SECTION_COLLAPSE,
      JSON.stringify(["stale-section-id", "trackers"])
    )

    const { result } = renderHook(() => useSectionCollapse())
    await act(async () => {})

    expect(result.current.hydrated).toBe(true)
    // Unknown id just behaves like any other collapsed id — querying it doesn't throw,
    // and it does not affect the state of ids that are actually rendered.
    expect(() => result.current.isCollapsed("stale-section-id")).not.toThrow()
    expect(result.current.isCollapsed("trackers")).toBe(true)
    expect(result.current.isCollapsed("some-other-section")).toBe(false)
  })

  it("ignores malformed (non-array) storage content and hydrates to defaults", async () => {
    localStorage.setItem(STORAGE_KEYS.SECTION_COLLAPSE, JSON.stringify({ not: "an array" }))

    const { result } = renderHook(() => useSectionCollapse())
    await act(async () => {})

    expect(result.current.hydrated).toBe(true)
    expect(result.current.isCollapsed("trackers")).toBe(false)
  })
})
