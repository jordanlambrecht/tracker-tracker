// src/hooks/useSectionCollapse.ts
//
// Persists which primary dashboard sections are collapsed in localStorage.
// Mirrors the hydrate-then-render pattern in useChartPreferencesBase.ts so a
// collapsed section does not flash open before hydration completes.

"use client"

import { useCallback, useEffect, useState } from "react"
import { STORAGE_KEYS } from "@/lib/storage-keys"

interface SectionCollapseState {
  isCollapsed: (id: string) => boolean
  toggle: (id: string) => void
  hydrated: boolean
}

function useSectionCollapse(): SectionCollapseState {
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SECTION_COLLAPSE)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setCollapsed(parsed.filter((id): id is string => typeof id === "string"))
        }
      }
    } catch {
      // SSR or corrupt storage. Keep empty defaults.
    }
    setHydrated(true)
  }, [])

  const persist = useCallback((next: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SECTION_COLLAPSE, JSON.stringify(next))
    } catch {
      // SSR or quota exceeded
    }
  }, [])

  const isCollapsed = useCallback((id: string) => collapsed.includes(id), [collapsed])

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        persist(next)
        return next
      })
    },
    [persist]
  )

  return { isCollapsed, toggle, hydrated }
}

export type { SectionCollapseState }
export { useSectionCollapse }
