// src/components/layout/Sidebar.tsx

"use client"

import { closestCenter, DndContext } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { BookIcon, EyeIcon, EyeOffIcon, GitHubIcon } from "@icons"
import clsx from "clsx"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { ChangelogDialog } from "@/components/layout/ChangelogDialog"
import { DownloadClientStatusWidget } from "@/components/layout/DownloadClientStatusWidget"
import { SortableTrackerItem } from "@/components/layout/SortableTrackerItem"
import { Button, ChevronToggle, PillTag, Select, Shimmer, Tooltip } from "@/components/ui"
import { useSidebarPreferences } from "@/hooks/useSidebarPreferences"
import { useTrackerList } from "@/hooks/useTrackerList"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import { DOCS_URL } from "@/lib/constants"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  isMobile?: boolean
}

function Sidebar({ collapsed, onToggle, isMobile = false }: SidebarProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()
  const { latestVersion, updateAvailable } = useUpdateCheck()

  const prefs = useSidebarPreferences()
  const {
    trackers,
    loading: trackersLoading,
    displayedTrackers,
    trackerIds,
    archivedCount,
    toggleFavorite,
    handleDragEnd,
    refresh,
  } = useTrackerList({
    sortMode: prefs.sortMode,
    showFavoritesOnly: prefs.showFavoritesOnly,
    showArchived: prefs.showArchived,
    onSortModeChange: prefs.setSortMode,
  })

  const existingBaseUrls = useMemo(() => trackers.map((t) => t.baseUrl), [trackers])

  function openChangelog() {
    setChangelogOpen(true)
  }

  return (
    <>
      <aside
        className={clsx(
          "h-screen flex flex-col bg-base border-r border-border overflow-x-clip",
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
              onClick={onToggle}
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
              onClick={() => prefs.setFiltersExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer"
              aria-expanded={prefs.filtersExpanded}
              aria-label={prefs.filtersExpanded ? "Collapse filters" : "Expand filters"}
            >
              <span className="text-3xs font-mono uppercase tracking-wider">Filters</span>
              <ChevronToggle expanded={prefs.filtersExpanded} variant="flip" />
            </button>
            <div
              className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
              style={{
                gridTemplateRows: prefs.filtersExpanded ? "1fr" : "0fr",
                opacity: prefs.filtersExpanded ? 1 : 0,
              }}
            >
              <div className={prefs.filtersExpanded ? "overflow-visible" : "overflow-hidden"}>
                <div className="px-3 pb-2 flex items-center gap-2">
                  <Select
                    value={prefs.statMode}
                    onChange={prefs.setStatMode}
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
                    value={prefs.sortMode}
                    onChange={prefs.setSortMode}
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
                    onClick={() => prefs.setShowFavoritesOnly((f) => !f)}
                    className={clsx(
                      "transition-colors duration-150 cursor-pointer px-2 py-1.5 shrink-0 rounded-nm-sm",
                      prefs.showFavoritesOnly ? "text-warn" : "text-tertiary hover:text-secondary"
                    )}
                    aria-label={
                      prefs.showFavoritesOnly ? "Show all trackers" : "Show favorites only"
                    }
                  >
                    <Tooltip
                      content={
                        prefs.showFavoritesOnly ? "Show all trackers" : "Show favorites only"
                      }
                    >
                      <span>{prefs.showFavoritesOnly ? "★" : "☆"}</span>
                    </Tooltip>
                  </button>

                  {/* Lock/unlock drag-and-drop */}
                  <button
                    type="button"
                    onClick={() => prefs.setUnlocked((u) => !u)}
                    className="text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer px-2 py-1.5 shrink-0 rounded-nm-sm"
                    aria-label={prefs.unlocked ? "Lock order" : "Unlock to reorder"}
                  >
                    <Tooltip content={prefs.unlocked ? "Lock order" : "Unlock to reorder"}>
                      <span>{prefs.unlocked ? "🔓" : "🔒"}</span>
                    </Tooltip>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tracker list (scrollable) */}
          <nav className="flex-1 overflow-y-auto py-2 styled-scrollbar" aria-label="Trackers">
            {trackersLoading ? (
              <div className="flex flex-col gap-4 px-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={`tracker-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <Shimmer rounded="full" className="h-4 w-4" />
                    <Shimmer size="text" className="flex-1" />
                    <Shimmer size="label" className="w-12" />
                  </div>
                ))}
              </div>
            ) : trackers.length === 0 ? (
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
                          unlocked={prefs.unlocked}
                          statMode={prefs.statMode}
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
                  onClick={() => prefs.setShowArchived((s) => !s)}
                  className="ghost-link flex items-center gap-2 duration-150 w-full"
                >
                  {prefs.showArchived ? (
                    <EyeOffIcon width="14" height="14" className="shrink-0" />
                  ) : (
                    <EyeIcon width="14" height="14" className="shrink-0" />
                  )}
                  {prefs.showArchived ? "Hide" : "Show"} Archived ({archivedCount})
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
          <DownloadClientStatusWidget />

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
            <div className="flex items-center gap-2.5 px-1 pt-4 pb-1">
              <button
                type="button"
                onClick={openChangelog}
                className="font-mono text-xs text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer text-left"
              >
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </button>
              {process.env.NEXT_PUBLIC_RELEASE_CHANNEL === "development" && (
                <PillTag color="warn" size="md" label="dev" />
              )}
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
              <a
                href="https://github.com/jordanlambrecht/tracker-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="text-tertiary hover:text-secondary transition-colors duration-150 shrink-0"
                aria-label="GitHub repository"
              >
                <GitHubIcon width="15" height="15" />
              </a>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tertiary hover:text-secondary transition-colors duration-150 shrink-0"
                aria-label="Documentation"
              >
                <BookIcon width="15" height="15" />
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
          refresh()
          router.push(`/trackers/${id}`)
        }}
        existingBaseUrls={existingBaseUrls}
      />

      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  )
}

export { Sidebar }
