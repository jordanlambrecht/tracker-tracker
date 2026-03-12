// src/hooks/useChartPreferencesBase.ts
//
// Functions: useChartPreferencesBase
//
// Shared base hook for chart visibility, collapse state, and localStorage persistence.
// Used by useChartPreferences (dashboard) and useFleetChartPreferences (fleet).
// Prefs shape must extend { hidden: string[]; collapsed: string[] }.

"use client"

import { useCallback, useEffect, useState } from "react"

interface BaseChartPrefs {
  hidden: string[]
  collapsed: string[]
}

interface ChartPreferencesBase<T extends BaseChartPrefs> {
  prefs: T
  setPrefs: (updater: T | ((prev: T) => T)) => void
  hydrated: boolean
  isHidden: (id: string) => boolean
  isCollapsed: (id: string) => boolean
  toggleHidden: (id: string) => void
  toggleCollapsed: (id: string) => void
  setVisible: (id: string, visible: boolean) => void
  collapseAll: (chartIds: string[]) => void
  allVisibleCollapsed: (chartIds: string[]) => boolean
}

function useChartPreferencesBase<T extends BaseChartPrefs>(
  storageKey: string,
  emptyPrefs: T
): ChartPreferencesBase<T> {
  const [prefs, setPrefsState] = useState<T>(emptyPrefs)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<T>
        setPrefsState((prev) => ({
          ...prev,
          ...parsed,
          hidden: parsed.hidden ?? [],
          collapsed: parsed.collapsed ?? [],
        }))
      }
    } catch {
      // SSR or corrupt storage — keep empty defaults
    }
    setHydrated(true)
  }, [storageKey])

  const persist = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // SSR or quota exceeded
      }
    },
    [storageKey]
  )

  const setPrefs = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setPrefsState((prev) => {
        const next = typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater
        persist(next)
        return next
      })
    },
    [persist]
  )

  const isHidden = useCallback((id: string) => prefs.hidden.includes(id), [prefs.hidden])

  const isCollapsed = useCallback((id: string) => prefs.collapsed.includes(id), [prefs.collapsed])

  const toggleHidden = useCallback(
    (id: string) => {
      setPrefs((prev) => {
        const hidden = prev.hidden.includes(id)
          ? prev.hidden.filter((x) => x !== id)
          : [...prev.hidden, id]
        return { ...prev, hidden }
      })
    },
    [setPrefs]
  )

  const toggleCollapsed = useCallback(
    (id: string) => {
      setPrefs((prev) => {
        const collapsed = prev.collapsed.includes(id)
          ? prev.collapsed.filter((x) => x !== id)
          : [...prev.collapsed, id]
        return { ...prev, collapsed }
      })
    },
    [setPrefs]
  )

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      setPrefs((prev) => {
        const hidden = visible
          ? prev.hidden.filter((x) => x !== id)
          : prev.hidden.includes(id)
            ? prev.hidden
            : [...prev.hidden, id]
        return { ...prev, hidden }
      })
    },
    [setPrefs]
  )

  const collapseAll = useCallback(
    (chartIds: string[]) => {
      setPrefs((prev) => {
        const visibleIds = chartIds.filter((id) => !prev.hidden.includes(id))
        const allCollapsed =
          visibleIds.length > 0 && visibleIds.every((id) => prev.collapsed.includes(id))
        const collapsed = allCollapsed
          ? prev.collapsed.filter((id) => !visibleIds.includes(id))
          : [...new Set([...prev.collapsed, ...visibleIds])]
        return { ...prev, collapsed }
      })
    },
    [setPrefs]
  )

  const allVisibleCollapsed = useCallback(
    (chartIds: string[]) => {
      const visibleIds = chartIds.filter((id) => !prefs.hidden.includes(id))
      return visibleIds.length > 0 && visibleIds.every((id) => prefs.collapsed.includes(id))
    },
    [prefs]
  )

  return {
    prefs,
    setPrefs,
    hydrated,
    isHidden,
    isCollapsed,
    toggleHidden,
    toggleCollapsed,
    setVisible,
    collapseAll,
    allVisibleCollapsed,
  }
}

export { useChartPreferencesBase }
export type { BaseChartPrefs, ChartPreferencesBase }
