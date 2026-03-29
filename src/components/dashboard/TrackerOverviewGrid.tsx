// src/components/dashboard/TrackerOverviewGrid.tsx
"use client"

import { useAutoAnimate } from "@formkit/auto-animate/react"
import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Checkbox } from "@/components/ui/Checkbox"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { FilterPill } from "@/components/ui/FilterPill"
import { ExternalLinkIcon, PlusIcon } from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import { RedactedText } from "@/components/ui/RedactedText"
import { findRegistryEntry, type TrackerRegistryEntry } from "@/data/tracker-registry"
import { ALL_TRACKERS } from "@/data/trackers"
import { useClickOutside } from "@/hooks/useClickOutside"
import { formatAccountAge, formatJoinedDate, formatRatioDisplay } from "@/lib/formatters"
import { getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

const FILTER_THRESHOLD = 6

interface TrackerOverviewGridProps {
  trackers: TrackerSummary[]
  showHealthIndicators?: boolean
}

function TrackerOverviewGrid({ trackers, showHealthIndicators = true }: TrackerOverviewGridProps) {
  const router = useRouter()
  const [gridRef] = useAutoAnimate({ duration: 200 })
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  useClickOutside(pickerRef, () => setPickerOpen(false), pickerOpen)

  // Load draft quicklinks from DB on mount
  useEffect(() => {
    async function loadQuicklinks() {
      try {
        const res = await fetch("/api/settings/quicklinks")
        if (!res.ok) return
        const data = (await res.json()) as { slugs: string[] }
        const dbSlugs = Array.isArray(data.slugs) ? data.slugs : []
        setSelectedDrafts(dbSlugs)
      } catch {
        // Silently ignore fetch failures
      }
    }

    loadQuicklinks()
  }, [])

  async function saveSlugs(slugs: string[]) {
    try {
      await fetch("/api/settings/quicklinks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
      })
    } catch {
      // Silently ignore save failures
    }
  }

  const draftTrackers = ALL_TRACKERS.filter((t: TrackerRegistryEntry) => t.draft)
  const selectedDraftTrackers = draftTrackers.filter((t: TrackerRegistryEntry) =>
    selectedDrafts.includes(t.slug)
  )

  // Build category lookup and unique category list from active trackers
  const { trackerCategories, allCategories } = useMemo(() => {
    const catMap = new Map<number, string[]>()
    const catSet = new Set<string>()
    for (const t of trackers) {
      const entry = findRegistryEntry(t.baseUrl)
      const cats = entry?.contentCategories ?? []
      catMap.set(t.id, cats)
      for (const c of cats) catSet.add(c)
    }
    return {
      trackerCategories: catMap,
      allCategories: [...catSet].sort(),
    }
  }, [trackers])

  const showFilters = trackers.length > FILTER_THRESHOLD
  const hasFavorites = trackers.some((t) => t.isFavorite)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Count active filters for mobile badge
  const activeFilterCount = (favoritesOnly ? 1 : 0) + (categoryFilter ? 1 : 0)

  // Apply filters
  const filteredTrackers = useMemo(() => {
    let result = trackers
    if (showFilters && favoritesOnly) {
      result = result.filter((t) => t.isFavorite)
    }
    if (showFilters && categoryFilter) {
      result = result.filter((t) => {
        const cats = trackerCategories.get(t.id) ?? []
        return cats.includes(categoryFilter)
      })
    }
    return result
  }, [trackers, showFilters, favoritesOnly, categoryFilter, trackerCategories])

  function toggleDraft(slug: string) {
    const next = selectedDrafts.includes(slug)
      ? selectedDrafts.filter((s) => s !== slug)
      : [...selectedDrafts, slug]
    setSelectedDrafts(next)
    saveSlugs(next)
  }

  if (trackers.length === 0 && selectedDraftTrackers.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Filters — only when > 6 trackers */}
      {showFilters && (
        <div className="flex flex-col gap-1.5">
          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex md:hidden items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-muted hover:text-secondary transition-colors cursor-pointer border-none bg-transparent"
            aria-expanded={filtersOpen}
          >
            <ChevronToggle expanded={filtersOpen} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-3xs font-semibold text-accent nm-raised-sm rounded-nm-pill">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Filter pills — always visible on md+, collapsible on mobile */}
          <div
            className={clsx(
              "flex-wrap items-center gap-1.5",
              filtersOpen ? "flex" : "hidden md:flex"
            )}
          >
            {/* Favorites toggle */}
            {hasFavorites && (
              <FilterPill
                active={favoritesOnly}
                onClick={() => setFavoritesOnly((v) => !v)}
                activeColor="text-accent"
              >
                {favoritesOnly ? "★" : "☆"} Favorites
              </FilterPill>
            )}

            {hasFavorites && allCategories.length > 0 && (
              <span className="w-px h-4 bg-border shrink-0" />
            )}

            {/* Category pills */}
            {allCategories.length > 0 && (
              <>
                <FilterPill
                  active={categoryFilter === null}
                  onClick={() => setCategoryFilter(null)}
                  text="All"
                />
                {allCategories.map((cat) => (
                  <FilterPill
                    key={cat}
                    active={categoryFilter === cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    text={cat}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3"
      >
        {/* Active tracker cards */}
        {filteredTrackers.map((t) => {
          const health = getTrackerHealth(t)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => router.push(`/trackers/${t.id}`)}
              className="flex flex-col gap-1.5 px-4 py-3 nm-interactive-sm cursor-pointer text-left h-full rounded-nm-md"
              style={{ borderLeft: `3px solid ${t.color}` }}
            >
              {/* Row 1: Status + name + ratio + external link */}
              <div className="flex items-center gap-2.5 w-full">
                {showHealthIndicators && (
                  <PulseDot
                    status={getHealthPulseDot(health)}
                    size="sm"
                    color={health === "healthy" ? t.color : undefined}
                  />
                )}
                <span className="font-sans text-sm font-semibold text-primary whitespace-nowrap flex-1 truncate">
                  {t.name}
                </span>
                <span className="font-mono text-xs text-tertiary tabular-nums shrink-0">
                  {formatRatioDisplay(t.latestStats?.ratio)}
                </span>
                <a
                  href={t.baseUrl.startsWith("http") ? t.baseUrl : `https://${t.baseUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nm-inset-sm bg-control-bg w-7 h-7 flex items-center justify-center text-muted hover:text-accent transition-colors duration-150 shrink-0 rounded-nm-sm"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open ${t.name}`}
                >
                  <ExternalLinkIcon width="12" height="12" />
                </a>
              </div>

              {/* Row 2: Class/rank or paused indicator */}
              {health === "paused" || health === "paused-user" ? (
                <span
                  className={clsx(
                    "font-mono text-3xs uppercase tracking-wider ml-4.5",
                    health === "paused-user" ? "text-warn" : "text-danger"
                  )}
                >
                  ⏸ Polling paused
                </span>
              ) : (
                <RedactedText
                  value={t.latestStats?.group ?? null}
                  color={t.color}
                  className="font-mono text-xs text-accent ml-4.5"
                />
              )}

              {/* Row 3: Account age + join date */}
              {t.joinedAt ? (
                <span className="font-mono text-xs text-tertiary ml-4.5">
                  {formatAccountAge(t.joinedAt)} · Joined {formatJoinedDate(t.joinedAt)}
                </span>
              ) : (
                <span className="font-mono text-xs text-tertiary ml-4.5">&nbsp;</span>
              )}
            </button>
          )
        })}

        {/* Draft tracker quicklink cards */}
        {selectedDraftTrackers.map((dt: TrackerRegistryEntry) => (
          <a
            key={`draft-${dt.slug}`}
            href={dt.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col justify-center gap-1 px-4 py-3 nm-interactive-inset bg-control-bg cursor-pointer text-left h-full rounded-nm-md"
            style={{ borderLeft: `3px dashed ${dt.color}` }}
          >
            <div className="flex items-center gap-2.5 w-full">
              <span
                className="w-2 h-2 rounded-full shrink-0 opacity-40"
                style={{ backgroundColor: dt.color }}
              />
              <span className="font-sans text-sm font-semibold text-secondary whitespace-nowrap flex-1 truncate">
                {dt.name}
              </span>
              <ExternalLinkIcon
                width="12"
                height="12"
                className="text-muted shrink-0"
                strokeWidth={2}
              />
            </div>
            <span className="timestamp ml-4.5">Stats tracking not yet supported</span>
          </a>
        ))}

        {/* Add quicklink button */}
        {draftTrackers.length > 0 && (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center justify-center gap-2 w-full h-full min-h-18 px-4 py-3 border-2 border-dashed border-border/50 text-muted hover:text-secondary hover:border-border transition-colors cursor-pointer rounded-nm-md"
            >
              <PlusIcon width="14" height="14" />
              <span className="font-mono text-xs">Add Quick Link</span>
            </button>

            {/* Draft tracker picker popover */}
            {pickerOpen && (
              <div className="absolute top-full left-0 mt-2 z-40 w-80 max-h-72 overflow-y-auto nm-raised bg-elevated p-3 flex flex-col gap-1 styled-scrollbar rounded-nm-md">
                <p className="text-3xs font-mono text-warn px-2 py-1.5 nm-inset-sm bg-control-bg mb-2 rounded-nm-sm">
                  These trackers don't have adapter support yet — links only, no stats tracking.
                </p>
                {draftTrackers.map((dt: TrackerRegistryEntry) => (
                  <div key={dt.slug} className="flex items-center gap-2 px-1">
                    <Checkbox
                      checked={selectedDrafts.includes(dt.slug)}
                      onChange={() => toggleDraft(dt.slug)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dt.color }}
                        />
                        <span className="text-sm text-secondary">{dt.name}</span>
                      </span>
                    </Checkbox>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export { TrackerOverviewGrid }
