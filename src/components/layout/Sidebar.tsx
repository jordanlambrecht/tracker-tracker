// src/components/layout/Sidebar.tsx
//
// Functions:
//   sortTrackers
//   SortableTrackerItem
//   Sparkline
//   ClientStatusWidget
//   Sidebar

"use client"

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { H2 } from "@typography"
import clsx from "clsx"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Button } from "@/components/ui/Button"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { DownloadArrowIcon, EyeIcon, EyeOffIcon, GitHubIcon, UploadArrowIcon } from "@/components/ui/Icons"
import { MarqueeText } from "@/components/ui/MarqueeText"
import { PulseDot } from "@/components/ui/PulseDot"
import { Select } from "@/components/ui/Select"
import { Tooltip } from "@/components/ui/Tooltip"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import { DOCS_URL } from "@/lib/constants"
import { hexToRgba } from "@/lib/color-utils"
import {
  formatBytesNum,
  formatSpeed,
  formatStatValue,
  formatTimeAgo,
  type StatMode,
} from "@/lib/formatters"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

const ChangelogContent = dynamic(() => import("./ChangelogContent"), { ssr: false })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortMode = "index" | "alpha" | "custom"

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  isMobile?: boolean
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function sortTrackers(trackers: TrackerSummary[], mode: SortMode): TrackerSummary[] {
  const sorted = [...trackers]
  switch (mode) {
    case "alpha":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "custom":
      return sorted.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))
    default:
      // "index" — preserve API order (createdAt ascending from the server)
      return sorted
  }
}

// Select extracted to @/components/ui/Select

// ---------------------------------------------------------------------------
// SortableTrackerItem
// ---------------------------------------------------------------------------

interface SortableTrackerItemProps {
  tracker: TrackerSummary
  isActive: boolean
  unlocked: boolean
  statMode: StatMode
  onToggleFavorite: (id: number, current: boolean) => void
}

function SortableTrackerItem({
  tracker,
  isActive,
  unlocked,
  statMode,
  onToggleFavorite,
}: SortableTrackerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tracker.id,
  })

  const archived = !tracker.isActive
  const health = getTrackerHealth(tracker)
  const tc = tracker.color || CHART_THEME.accent
  const stat = formatStatValue(tracker.latestStats, statMode)

  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const activeStyle: CSSProperties = isActive
    ? {
        backgroundColor: hexToRgba(tc, 0.08),
        filter: `drop-shadow(0 0 10px ${hexToRgba(tc, 0.15)})`,
      }
    : {}

  const itemClasses = clsx(
    "w-full flex items-center gap-3 px-4 py-3 text-left group",
    unlocked ? "animate-jiggle cursor-grab" : "cursor-pointer",
    archived && "opacity-40",
    isActive ? "text-primary nm-raised-sm" : "text-secondary nm-interactive-sm hover:text-primary"
  )

  const children = (
    <>
      {unlocked && (
        <span
          className="text-tertiary shrink-0 text-sm leading-none select-none"
          aria-hidden="true"
        >
          ⠿
        </span>
      )}
      {archived ? (
        <span className="w-2 h-2 rounded-full bg-muted shrink-0" aria-hidden="true" />
      ) : (
        <PulseDot status={getHealthPulseDot(health)} size="sm" />
      )}
      <span className="flex-1 truncate text-sm font-semibold">{tracker.name}</span>
      <span className="font-mono text-xs tabular-nums text-tertiary shrink-0">
        {archived ? "Archived" : stat}
      </span>
      {!unlocked && (
        // biome-ignore lint/a11y/useSemanticElements: Star must be inside parent button for visual layout
        <span
          role="button"
          tabIndex={0}
          aria-pressed={tracker.isFavorite}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleFavorite(tracker.id, tracker.isFavorite)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(tracker.id, tracker.isFavorite)
            }
          }}
          className={clsx(
            "shrink-0 text-sm leading-none transition-all duration-150 cursor-pointer bg-transparent border-none p-0",
            tracker.isFavorite
              ? "text-warn opacity-100"
              : "text-muted opacity-0 group-hover:opacity-50 hover:opacity-100!"
          )}
          aria-label={tracker.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {tracker.isFavorite ? "★" : "☆"}
        </span>
      )}
    </>
  )

  const cls = `${itemClasses} rounded-nm-md`

  return (
    <li ref={setNodeRef} style={dragStyle}>
      {unlocked ? (
        <button
          type="button"
          className={cls}
          style={activeStyle}
          aria-current={isActive ? "page" : undefined}
          {...attributes}
          {...listeners}
        >
          {children}
        </button>
      ) : (
        <Link
          href={`/trackers/${tracker.id}`}
          prefetch
          className={cls}
          style={activeStyle}
          aria-current={isActive ? "page" : undefined}
        >
          {children}
        </Link>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

function Sparkline({
  data,
  color,
  height = 24,
  width = 80,
}: {
  data: number[]
  color: string
  height?: number
  width?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`)
  const fillPoints = `0,${height} ${points.join(" ")} ${width},${height}`

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden="true">
      <polygon points={fillPoints} fill={color} opacity={0.1} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Client Status Widget
// ---------------------------------------------------------------------------

interface ClientInfo {
  id: number
  name: string
  enabled: boolean
  lastError: string | null
  errorSince: string | null
  lastPolledAt: string | null
}

interface SpeedPoint {
  up: number
  down: number
}

interface ClientWithSpeeds {
  client: ClientInfo
  speeds: SpeedPoint[]
}

function ClientSlide({
  entry,
  expanded,
  onToggle,
}: {
  entry: ClientWithSpeeds
  expanded: boolean
  onToggle: () => void
}) {
  const { client } = entry
  const hasError = !!client.lastError

  return (
    <button
      type="button"
      onClick={onToggle}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex items-center gap-2 cursor-pointer w-full text-left"
    >
      <span
        className={clsx("w-2 h-2 rounded-full shrink-0", hasError ? "bg-danger" : "bg-success")}
        style={hasError ? undefined : { boxShadow: "0 0 6px var(--color-success)" }}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <MarqueeText className="text-xs font-mono text-secondary">{client.name}</MarqueeText>
        <span className="text-3xs font-mono text-tertiary">
          {hasError ? (
            <span className="text-danger">
              Down{client.errorSince ? ` ${formatTimeAgo(client.errorSince)}` : ""}
            </span>
          ) : !expanded && entry.speeds.length > 0 ? (
            <span className="flex items-center gap-2">
              <span className="text-accent">
                {formatSpeed(entry.speeds[entry.speeds.length - 1].up)}↑
              </span>
              <span className="text-warn">
                {formatSpeed(entry.speeds[entry.speeds.length - 1].down)}↓
              </span>
            </span>
          ) : (
            "Connected"
          )}
        </span>
      </div>
      <ChevronToggle expanded={expanded} variant="flip" />
    </button>
  )
}

function ClientStatusWidget() {
  const [entries, setEntries] = useState<ClientWithSpeeds[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState<"left" | "right">("left")
  const [animating, setAnimating] = useState(false)
  const [expanded, setExpanded] = useLocalStorage(STORAGE_KEYS.CLIENT_WIDGET_EXPANDED, false)

  // Set height-based default on first visit (when no preference is stored)
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLIENT_WIDGET_EXPANDED) === null) {
        setExpanded(window.innerHeight >= 800)
      }
    } catch {}
  }, [setExpanded])

  const goTo = useCallback(
    (next: number) => {
      setActiveIndex((prev) => {
        setDirection(next > prev || (prev === entries.length - 1 && next === 0) ? "left" : "right")
        setAnimating(true)
        return next
      })
    },
    [entries.length]
  )

  useEffect(() => {
    if (!animating) return
    const t = setTimeout(() => setAnimating(false), 300)
    return () => clearTimeout(t)
  }, [animating])

  // Auto-rotate carousel
  useEffect(() => {
    if (entries.length <= 1) return
    const timer = setInterval(() => {
      goTo((activeIndex + 1) % entries.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [entries.length, activeIndex, goTo])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const clientsRes = await fetch("/api/clients")
        if (!clientsRes.ok) return
        const clients: ClientInfo[] = await clientsRes.json()
        const enabled = clients.filter((c) => c.enabled)
        if (enabled.length === 0 || cancelled) return

        const results: ClientWithSpeeds[] = await Promise.all(
          enabled.map(async (client) => {
            try {
              const snapRes = await fetch(`/api/clients/${client.id}/speeds`)
              if (!snapRes.ok) return { client, speeds: [] }
              const snaps: { timestamp: number; uploadSpeed: number; downloadSpeed: number }[] =
                await snapRes.json()
              return {
                client,
                speeds: snaps.map((s) => ({
                  up: s.uploadSpeed,
                  down: s.downloadSpeed,
                })),
              }
            } catch {
              return { client, speeds: [] }
            }
          })
        )

        if (!cancelled) {
          setEntries(results)
          setActiveIndex((prev) => (prev >= results.length ? 0 : prev))
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    poll()
    const interval = setInterval(poll, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Swipe/drag gesture for carousel (touch + pointer for desktop)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const pointerDown = useRef(false)

  const handleSwipeStart = useCallback((x: number, y: number) => {
    swipeStartX.current = x
    swipeStartY.current = y
  }, [])

  const handleSwipeEnd = useCallback(
    (x: number, y: number) => {
      if (entries.length <= 1) return
      const dx = x - swipeStartX.current
      const dy = y - swipeStartY.current
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) goTo((activeIndex + 1) % entries.length)
      else goTo((activeIndex - 1 + entries.length) % entries.length)
    },
    [entries.length, activeIndex, goTo]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerDown.current = true
      handleSwipeStart(e.clientX, e.clientY)
    },
    [handleSwipeStart]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerDown.current) return
      pointerDown.current = false
      handleSwipeEnd(e.clientX, e.clientY)
    },
    [handleSwipeEnd]
  )

  // Capture pointer so up fires even if cursor leaves the element
  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      onPointerDown(e)
    },
    [onPointerDown]
  )

  if (!loaded || entries.length === 0) return null

  const current = entries[activeIndex]

  return (
    <div className="px-3 py-3 border-t border-border shrink-0">
      <div
        className="nm-inset-sm bg-control-bg px-3 pt-2.5 pb-3.5 flex flex-col gap-2 rounded-nm-md touch-pan-y"
        onPointerDown={onPointerDownCapture}
        onPointerUp={onPointerUp}
      >
        <div
          key={activeIndex}
          className="overflow-hidden"
          style={{
            animation: animating
              ? `slideIn${direction === "left" ? "Left" : "Right"} 300ms ease-out both`
              : undefined,
          }}
        >
          <ClientSlide
            entry={current}
            expanded={expanded}
            onToggle={() => setExpanded((prev) => !prev)}
          />

          {/* Collapsible sparklines */}
          {current.speeds.length >= 2 && (
            <div
              className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
              style={{
                gridTemplateRows: expanded ? "1fr" : "0fr",
                opacity: expanded ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-3 pt-1.5">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UploadArrowIcon
                        width="10"
                        height="10"
                        stroke="var(--color-accent)"
                        strokeWidth={2.5}
                        className="shrink-0"
                      />
                      <Sparkline
                        data={current.speeds.map((s) => s.up)}
                        color="var(--color-accent)"
                        width={160}
                        height={16}
                      />
                      <span className="text-xs font-mono text-accent tabular-nums shrink-0">
                        {formatSpeed(current.speeds[current.speeds.length - 1].up)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DownloadArrowIcon
                        width="10"
                        height="10"
                        stroke="var(--color-warn)"
                        strokeWidth={2.5}
                        className="shrink-0"
                      />
                      <Sparkline
                        data={current.speeds.map((s) => s.down)}
                        color="var(--color-warn)"
                        width={160}
                        height={16}
                      />
                      <span className="text-xs font-mono text-warn tabular-nums shrink-0">
                        {formatSpeed(current.speeds[current.speeds.length - 1].down)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dot indicators for carousel */}
        {entries.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-0.5">
            {entries.map((entry, i) => (
              <button
                key={entry.client.id}
                type="button"
                onClick={() => goTo(i)}
                className={clsx(
                  "w-1.5 h-1.5 rounded-full transition-all duration-200 cursor-pointer",
                  i === activeIndex ? "bg-accent scale-125" : "bg-muted hover:bg-tertiary"
                )}
                aria-label={`Show ${entry.client.name}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({ collapsed: collapsedProp, onToggle, isMobile = false }: SidebarProps) {
  const [trackers, setTrackers] = useState<TrackerSummary[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [statMode, setStatMode] = useState<StatMode>("ratio")
  const [sortMode, setSortMode] = useState<SortMode>("index")
  const [unlocked, setUnlocked] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useLocalStorage("sidebar-filters-expanded", true)
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [changelogContent, setChangelogContent] = useState<string | null>(null)
  const changelogRef = useRef<HTMLDialogElement>(null)
  const { latestVersion, updateAvailable } = useUpdateCheck()

  const pathname = usePathname()
  const router = useRouter()

  // Determine whether collapsed is externally controlled or internal
  const collapsed = collapsedProp !== undefined ? collapsedProp : internalCollapsed
  const handleToggle = onToggle ?? (() => setInternalCollapsed((c) => !c))

  // Hydrate preferences from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const savedStat = localStorage.getItem(STORAGE_KEYS.SIDEBAR_STAT_MODE) as StatMode | null
      if (savedStat) setStatMode(savedStat)
      const savedSort = localStorage.getItem(STORAGE_KEYS.SIDEBAR_SORT_MODE) as SortMode | null
      if (savedSort) setSortMode(savedSort)
    } catch {
      // ignore
    }
  }, [])

  // Fetch trackers on mount and on interval; re-run when refreshKey increments
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is a manual trigger — incrementing it intentionally re-runs the fetch
  useEffect(() => {
    let cancelled = false

    async function fetchTrackers() {
      try {
        const res = await fetch("/api/trackers")
        if (!res.ok) return
        const data: TrackerSummary[] = await res.json()
        if (!cancelled) {
          setTrackers(data)

          // Auto-detect custom sort on first load if no preference saved
          if (
            !localStorage.getItem(STORAGE_KEYS.SIDEBAR_SORT_MODE) &&
            data.some((t) => t.sortOrder !== null)
          ) {
            setSortMode("custom")
          }
        }
      } catch {
        // silently ignore fetch errors
      }
    }

    fetchTrackers()
    const interval = setInterval(fetchTrackers, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [refreshKey])

  async function openChangelog() {
    if (changelogContent === null) {
      try {
        const res = await fetch("/api/changelog")
        const data = await res.json()
        setChangelogContent(data.content)
      } catch {
        setChangelogContent("Failed to load changelog.")
      }
    }
    setChangelogOpen(true)
    requestAnimationFrame(() => changelogRef.current?.showModal())
  }

  const toggleFavorite = useCallback((id: number, current: boolean) => {
    const next = !current
    setTrackers((prev) => prev.map((t) => (t.id === id ? { ...t, isFavorite: next } : t)))
    fetch(`/api/trackers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: next }),
    }).catch(() => {
      // Revert on failure
      setTrackers((prev) => prev.map((t) => (t.id === id ? { ...t, isFavorite: current } : t)))
    })
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setTrackers((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id)
      const newIndex = prev.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const reordered = arrayMove(prev, oldIndex, newIndex).map((t, i) => ({
        ...t,
        sortOrder: i,
      }))

      const ids = reordered.map((t) => t.id)
      fetch("/api/trackers/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }).catch(() => {
        // ignore network errors
      })

      return reordered
    })

    // Switch to custom sort and persist
    setSortMode("custom")
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_SORT_MODE, "custom")
    } catch {
      // ignore
    }
  }, [])

  function updateStatMode(mode: StatMode) {
    setStatMode(mode)
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_STAT_MODE, mode)
    } catch {}
  }

  function updateSortMode(mode: SortMode) {
    setSortMode(mode)
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_SORT_MODE, mode)
    } catch {}
  }

  const filteredTrackers = trackers
    .filter((t) => showArchived || t.isActive)
    .filter((t) => !showFavoritesOnly || t.isFavorite)
  const displayedTrackers = sortTrackers(filteredTrackers, sortMode)
  const trackerIds = displayedTrackers.map((t) => t.id)
  const archivedCount = trackers.filter((t) => !t.isActive).length

  return (
    <>
      <aside
        className={clsx(
          "h-screen flex flex-col bg-base border-r border-border overflow-hidden",
          isMobile ? "fixed inset-y-0 left-0 z-30 shrink-0" : "shrink-0"
        )}
        style={
          isMobile
            ? {
                width: "20rem",
                transform: collapsed ? "translateX(-100%)" : "translateX(0)",
                transition: "transform 300ms ease",
              }
            : {
                width: collapsed ? 0 : "20rem",
                borderRightWidth: collapsed ? 0 : undefined,
                transition: "width 300ms ease, border-right-width 300ms ease",
              }
        }
      >
        <div className="w-80 min-w-80 h-full flex flex-col">
          {/* Logo area */}
          <div className="px-4 py-4 border-b border-border shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/")}
              className={clsx(
                "flex items-center gap-2 cursor-pointer transition-opacity duration-150",
                pathname === "/" ? "opacity-100" : "opacity-70 hover:opacity-100"
              )}
              aria-label="Go to dashboard"
              aria-current={pathname === "/" ? "page" : undefined}
            >
              <Image
                src="/img/trackerTracker_logo.svg"
                alt="Tracker Tracker"
                width={140}
                height={40}
                className="shrink-0"
                style={{ width: 140, height: "auto" }}
                priority
              />
            </button>
            <button
              type="button"
              onClick={handleToggle}
              className="text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer p-1 rounded-nm-sm"
              aria-label="Collapse sidebar"
            >
              ◀
            </button>
          </div>

          {/* Control bar */}
          <div className="border-b border-border shrink-0">
            <button
              type="button"
              onClick={() => setFiltersExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer"
              aria-expanded={filtersExpanded}
              aria-label={filtersExpanded ? "Collapse filters" : "Expand filters"}
            >
              <span className="text-3xs font-mono uppercase tracking-wider">Filters</span>
              <ChevronToggle expanded={filtersExpanded} variant="flip" />
            </button>
            {filtersExpanded && (
              <div className="px-3 pb-2 flex items-center gap-2">
                <Select
                  value={statMode}
                  onChange={updateStatMode}
                  ariaLabel="Stat display mode"
                  options={[
                    { value: "ratio", label: "Ratio" },
                    { value: "seeding", label: "Seeding" },
                    { value: "uploaded", label: "Uploaded" },
                    { value: "downloaded", label: "Downloaded" },
                    { value: "buffer", label: "Buffer" },
                  ]}
                />

                <Select
                  value={sortMode}
                  onChange={updateSortMode}
                  ariaLabel="Sort order"
                  options={[
                    { value: "index", label: "Index" },
                    { value: "alpha", label: "A-Z" },
                    { value: "custom", label: "Custom" },
                  ]}
                />

                {/* Favorites filter */}
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly((f) => !f)}
                  className={clsx(
                    "transition-colors duration-150 cursor-pointer px-2 py-1.5 shrink-0 rounded-nm-sm",
                    showFavoritesOnly ? "text-warn" : "text-tertiary hover:text-secondary"
                  )}
                  aria-label={showFavoritesOnly ? "Show all trackers" : "Show favorites only"}
                >
                  <Tooltip
                    content={showFavoritesOnly ? "Show all trackers" : "Show favorites only"}
                  >
                    <span>{showFavoritesOnly ? "★" : "☆"}</span>
                  </Tooltip>
                </button>

                {/* Lock/unlock drag-and-drop */}
                <button
                  type="button"
                  onClick={() => setUnlocked((u) => !u)}
                  className="text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer px-2 py-1.5 shrink-0 rounded-nm-sm"
                  aria-label={unlocked ? "Lock order" : "Unlock to reorder"}
                >
                  <Tooltip content={unlocked ? "Lock order" : "Unlock to reorder"}>
                    <span>{unlocked ? "🔓" : "🔒"}</span>
                  </Tooltip>
                </button>
              </div>
            )}
          </div>

          {/* Tracker list (scrollable) */}
          <nav className="flex-1 overflow-y-auto py-2 styled-scrollbar" aria-label="Trackers">
            {trackers.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted font-mono">No trackers added yet.</p>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={trackerIds} strategy={verticalListSortingStrategy}>
                  <ul className="list-none m-0 p-0 flex flex-col gap-4 px-4">
                    {displayedTrackers.map((tracker) => {
                      const isActive = pathname === `/trackers/${tracker.id}`
                      return (
                        <SortableTrackerItem
                          key={tracker.id}
                          tracker={tracker}
                          isActive={isActive}
                          unlocked={unlocked}
                          statMode={statMode}
                          onToggleFavorite={toggleFavorite}
                        />
                      )
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            )}

            {/* Archive toggle + Add Tracker */}
            <div className="mx-4 mt-4 pt-4 pb-6 border-t border-border flex flex-col gap-2">
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived((s) => !s)}
                  className="ghost-link flex items-center gap-2 duration-150 w-full"
                >
                  {showArchived ? (
                    <EyeOffIcon width="14" height="14" className="shrink-0" />
                  ) : (
                    <EyeIcon width="14" height="14" className="shrink-0" />
                  )}
                  {showArchived ? "Hide" : "Show"} Archived ({archivedCount})
                </button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setShowAddDialog(true)}
                text="+ Add Tracker"
              />
            </div>
          </nav>

          {/* Client status widget */}
          <ClientStatusWidget />

          {/* Bottom controls — pinned */}
          <div className="px-3 py-4 border-t border-border shrink-0 flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" })
                  router.push("/login")
                }}
                className="text-tertiary hover:text-secondary text-sm font-mono flex items-center gap-3 transition-colors duration-150 cursor-pointer flex-1 px-1 py-1"
              >
                <span className="text-lg" aria-hidden="true">
                  ⏻
                </span>
                Log Out
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="text-tertiary hover:text-secondary text-sm font-mono flex items-center gap-3 transition-colors duration-150 cursor-pointer flex-1 px-1 py-1"
              >
                <span className="text-lg" aria-hidden="true">
                  ⚙
                </span>
                Settings
              </button>
            </div>

            {/* Version + GitHub + Docs */}
            <div className="flex items-center gap-2 px-1 pt-2">
              <button
                type="button"
                onClick={openChangelog}
                className="timestamp hover:text-secondary transition-colors duration-150 cursor-pointer text-left"
              >
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </button>
              {updateAvailable && latestVersion && (
                <a
                  href={`https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v${latestVersion}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-4xs font-mono text-accent hover:bg-accent/25 transition-colors duration-150"
                >
                  <Tooltip content={`Update available: v${latestVersion}`}>
                    <span className="flex items-center gap-1">
                      v{latestVersion}
                      <span aria-hidden="true">↑</span>
                    </span>
                  </Tooltip>
                </a>
              )}
              {/* biome-ignore lint/a11y/useAnchorContent: aria-label provides accessible content */}
              <a
                href="https://github.com/jordanlambrecht/tracker-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-secondary transition-colors duration-150 shrink-0"
                aria-label="GitHub repository"
              >
                <GitHubIcon width="12" height="12" />
              </a>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="torrent-cell hover:text-secondary transition-colors duration-150 shrink-0"
                aria-label="Documentation"
              >
                ?
              </a>
            </div>
          </div>
        </div>
      </aside>

      <AddTrackerDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={(id) => {
          setShowAddDialog(false)
          setRefreshKey((k) => k + 1)
          router.push(`/trackers/${id}`)
        }}
        existingBaseUrls={trackers.map((t) => t.baseUrl)}
      />

      {/* Changelog modal */}
      {changelogOpen && (
        <dialog
          ref={changelogRef}
          onClick={(e) => {
            if (e.target === changelogRef.current) {
              changelogRef.current?.close()
              setChangelogOpen(false)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              changelogRef.current?.close()
              setChangelogOpen(false)
            }
          }}
          onClose={() => setChangelogOpen(false)}
          className="fixed inset-0 m-auto w-full max-w-2xl max-h-[80vh] bg-elevated p-0 overflow-hidden backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col nm-raised-lg rounded-nm-xl border-0"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <H2 className="text-base font-semibold text-primary">
              Changelog — v{process.env.NEXT_PUBLIC_APP_VERSION}
            </H2>
            <Button
              variant="minimal"
              size="icon"
              className="-m-1 hover:text-primary"
              aria-label="Close changelog"
              onClick={() => {
                changelogRef.current?.close()
                setChangelogOpen(false)
              }}
              text="✕"
            />
          </div>
          <div className="overflow-y-auto px-6 py-5 styled-scrollbar prose prose-invert prose-sm max-w-none prose-headings:font-mono prose-headings:text-primary prose-h1:text-lg prose-h2:text-base prose-h2:text-white prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h3:text-sm prose-li:text-secondary prose-p:text-secondary prose-strong:text-primary prose-a:text-accent">
            {changelogContent ? (
              <ChangelogContent content={changelogContent} />
            ) : (
              <p className="text-muted">Loading...</p>
            )}
          </div>
        </dialog>
      )}
    </>
  )
}

export { Sidebar }
