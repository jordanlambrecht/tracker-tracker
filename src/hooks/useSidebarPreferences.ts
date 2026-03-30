// src/hooks/useSidebarPreferences.ts
"use client"

import { useLocalStorage } from "@/hooks/useLocalStorage"
import type { StatMode } from "@/lib/formatters"
import type { SortMode } from "@/lib/sidebar-types"
import { STORAGE_KEYS } from "@/lib/storage-keys"

interface UseSidebarPreferencesReturn {
  statMode: StatMode
  setStatMode: (mode: StatMode) => void
  sortMode: SortMode
  setSortMode: (mode: SortMode) => void
  filtersExpanded: boolean
  setFiltersExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
  showFavoritesOnly: boolean
  setShowFavoritesOnly: (value: boolean | ((prev: boolean) => boolean)) => void
  showArchived: boolean
  setShowArchived: (value: boolean | ((prev: boolean) => boolean)) => void
  unlocked: boolean
  setUnlocked: (value: boolean | ((prev: boolean) => boolean)) => void
}

function useSidebarPreferences(): UseSidebarPreferencesReturn {
  const [statMode, setStatMode] = useLocalStorage<StatMode>(STORAGE_KEYS.SIDEBAR_STAT_MODE, "ratio")
  const [sortMode, setSortMode] = useLocalStorage<SortMode>(STORAGE_KEYS.SIDEBAR_SORT_MODE, "index")
  const [filtersExpanded, setFiltersExpanded] = useLocalStorage(
    STORAGE_KEYS.SIDEBAR_FILTERS_EXPANDED,
    true
  )
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage(
    STORAGE_KEYS.SIDEBAR_FAVORITES_ONLY,
    false
  )
  const [showArchived, setShowArchived] = useLocalStorage(STORAGE_KEYS.SIDEBAR_SHOW_ARCHIVED, false)
  const [unlocked, setUnlocked] = useLocalStorage(STORAGE_KEYS.SIDEBAR_UNLOCKED, false)

  return {
    statMode,
    setStatMode,
    sortMode,
    setSortMode,
    filtersExpanded,
    setFiltersExpanded,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showArchived,
    setShowArchived,
    unlocked,
    setUnlocked,
  }
}

export type { UseSidebarPreferencesReturn }
export { useSidebarPreferences }
