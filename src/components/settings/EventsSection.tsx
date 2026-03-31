// src/components/settings/EventsSection.tsx
//
// Functions: formatTime, getDateKey, formatDateLabel, EventsSection
"use client"

import clsx from "clsx"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { CopyButton, DownloadButton } from "@/components/ui/ActionButtons"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { FilterPill } from "@/components/ui/FilterPill"
import { RefreshIcon, TrashIcon } from "@/components/ui/Icons"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { EventLogSkeleton } from "@/components/ui/skeletons"
import { useSetToggle } from "@/hooks/useSetToggle"
import {
  EVENT_CATEGORIES,
  EVENT_LEVELS,
  type EventCategory,
  type EventLevel,
  type SystemEvent,
} from "@/lib/events"
import { formatBytesNum, localDateStr } from "@/lib/formatters"
import { extractApiError } from "@/lib/helpers"
import type { EventsPageResponse } from "@/types/api"

const CATEGORY_STYLES: Record<EventCategory, { border: string; icon: string; iconColor: string }> =
  {
    polls: { border: "border-l-accent", icon: "✓", iconColor: "text-success" },
    auth: { border: "border-l-violet-400", icon: "◆", iconColor: "text-violet-400" },
    settings: { border: "border-l-warn", icon: "●", iconColor: "text-warn" },
    backups: { border: "border-l-success", icon: "■", iconColor: "text-success" },
    errors: { border: "border-l-danger", icon: "✕", iconColor: "text-danger" },
  }

const LEVEL_TEXT_COLORS: Record<EventLevel, string> = {
  debug: "text-violet-400",
  info: "text-accent",
  warn: "text-warn",
  error: "text-danger",
}

const ICON_BUTTON_CLASS =
  "flex items-center gap-2 px-2.5 py-1.5 text-xs font-sans font-medium text-tertiary hover:text-primary bg-elevated nm-raised-sm rounded-nm-sm transition-colors duration-150 cursor-pointer"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function getDateKey(iso: string): string {
  return new Date(iso).toDateString()
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

export function EventsSection() {
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const categories = useSetToggle<EventCategory>(EVENT_CATEGORIES)
  const levels = useSetToggle<EventLevel>(["info", "warn", "error"])
  const [searchQuery, setSearchQuery] = useState("")
  const [logSizeBytes, setLogSizeBytes] = useState(0)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ category: "all", limit: "1000", offset: "0" })
      const res = await fetch(`/api/settings/events?${params}`)
      if (!res.ok) throw new Error(await extractApiError(res, "Failed to load events"))
      const data = (await res.json()) as EventsPageResponse
      setEvents(data.events)
      if (typeof data.logSizeBytes === "number") setLogSizeBytes(data.logSizeBytes)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const filteredEvents = useMemo(() => {
    let result = events
    if (categories.size < EVENT_CATEGORIES.length) {
      result = result.filter((e) => categories.has(e.category))
    }
    if (levels.size < EVENT_LEVELS.length) {
      result = result.filter((e) => levels.has(e.level))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.detail?.toLowerCase().includes(q) ||
          e.trackerName?.toLowerCase().includes(q)
      )
    }
    return result
  }, [events, categories, levels, searchQuery])

  const copyValue = useMemo(() => {
    return filteredEvents
      .map((e) => {
        const ts = new Date(e.timestamp)
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d{3}Z$/, "")
        const parts = [`[${ts}]`, `[${e.level}]`, `[${e.category}]`, e.title]
        if (e.detail) parts.push(`— ${e.detail}`)
        return parts.join(" ")
      })
      .join("\n")
  }, [filteredEvents])

  async function handleClear() {
    setClearLoading(true)
    setClearError(null)
    try {
      const res = await fetch("/api/settings/logs", { method: "DELETE" })
      if (!res.ok) {
        setClearError(await extractApiError(res, "Failed to clear logs"))
        return
      }
      setClearConfirm(false)
      setLogSizeBytes(0)
      fetchEvents()
    } catch {
      setClearError("Failed to clear log file")
    } finally {
      setClearLoading(false)
    }
  }

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allCategoriesActive = categories.size === EVENT_CATEGORIES.length

  // Track date separators across the render
  let lastDateKey = ""

  return (
    <SettingsSection id="events" title="Events" cardClassName="flex flex-col gap-3">
      {/* ── Search + actions ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Input
          type="search"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-30 max-w-80 text-xs"
        />
        <span className="flex-1" />
        <CopyButton value={copyValue} />
        <DownloadButton
          url="/api/settings/logs/download"
          fallbackFilename={`tracker-tracker-${localDateStr()}.log`}
          onError={setError}
        />
        <button
          type="button"
          onClick={() => fetchEvents()}
          aria-label="Refresh events"
          className={ICON_BUTTON_CLASS}
        >
          <RefreshIcon width="12" height="12" />
        </button>
        <button
          type="button"
          onClick={() => setClearConfirm((v) => !v)}
          aria-label={
            logSizeBytes > 0 ? `Clear logs (${formatBytesNum(logSizeBytes)})` : "Clear logs"
          }
          className={clsx(ICON_BUTTON_CLASS, clearConfirm && "text-danger!")}
        >
          <TrashIcon width="12" height="12" />
        </button>
      </div>

      <div className="border-t border-border my-3" />

      {/* ── Filters (categories + levels) ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          size="sm"
          active={allCategoriesActive}
          onClick={() => categories.reset(EVENT_CATEGORIES)}
          text="All"
        />

        {EVENT_CATEGORIES.map((cat) => (
          <FilterPill
            key={cat}
            size="sm"
            active={categories.has(cat)}
            onClick={() => categories.toggle(cat)}
            inactive="strikethrough"
            text={cat.charAt(0).toUpperCase() + cat.slice(1)}
          />
        ))}

        <span className="flex-1" />

        <span className="w-px h-4 bg-border shrink-0 mx-0.5" />

        {EVENT_LEVELS.map((level) => (
          <FilterPill
            key={level}
            size="sm"
            active={levels.has(level)}
            onClick={() => levels.toggle(level)}
            activeColor={LEVEL_TEXT_COLORS[level]}
            inactive="strikethrough"
            text={level.charAt(0).toUpperCase() + level.slice(1)}
          />
        ))}
      </div>

      <div className="border-t border-border my-3" />

      {/* ── Clear confirmation ───────────────────────────────────── */}
      {clearConfirm && (
        <ConfirmAction
          message="Truncate log file? DB events are not affected."
          confirmLabel="Confirm"
          confirmingLabel="Clearing…"
          confirming={clearLoading}
          onConfirm={handleClear}
          onCancel={() => {
            setClearConfirm(false)
            setClearError(null)
          }}
        >
          <Notice message={clearError} />
        </ConfirmAction>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      <Notice message={error} />

      {/* ── Event stream ─────────────────────────────────────────── */}
      <div className="nm-inset-sm bg-control-bg overflow-x-auto overflow-y-auto max-h-140 styled-scrollbar rounded-nm-md">
        {loading && events.length === 0 ? (
          <EventLogSkeleton />
        ) : filteredEvents.length === 0 ? (
          <p className="px-3 py-8 text-xs font-mono text-muted text-center">
            {events.length === 0 ? "No events yet." : "No events match the current filters."}
          </p>
        ) : (
          filteredEvents.map((event, i) => {
            const style = CATEGORY_STYLES[event.category]
            const dateKey = getDateKey(event.timestamp)
            const showDateSep = dateKey !== lastDateKey
            lastDateKey = dateKey

            const isExpanded = expandedIds.has(event.id)
            const hasDetail = Boolean(event.detail)

            return (
              <div key={event.id}>
                {showDateSep && (
                  <div className="sticky top-0 z-10 px-3 py-1 text-3xs font-mono text-tertiary bg-overlay/90 backdrop-blur-sm border-b border-border">
                    {formatDateLabel(event.timestamp)}
                  </div>
                )}
                {(() => {
                  const rowClass = clsx(
                    "flex flex-col gap-0 px-3 py-1.5 text-xs font-mono border-l-3 w-full text-left",
                    style.border,
                    i % 2 === 0 ? "bg-control-bg" : "bg-elevated/50",
                    hasDetail &&
                      "cursor-pointer hover:bg-elevated/80 transition-colors duration-100"
                  )
                  const inner = (
                    <>
                      <div className="flex items-baseline gap-2 min-w-fit">
                        <span
                          className={clsx("shrink-0 w-3 text-center leading-none", style.iconColor)}
                        >
                          {style.icon}
                        </span>
                        <span className="text-tertiary shrink-0 tabular-nums w-15.5">
                          {formatTime(event.timestamp)}
                        </span>
                        <span className="text-secondary shrink-0">{event.title}</span>
                        {hasDetail && !isExpanded && (
                          <span className="text-tertiary truncate whitespace-nowrap">
                            — {event.detail}
                          </span>
                        )}
                      </div>
                      {isExpanded && event.detail && (
                        <pre className="text-tertiary text-2xs leading-relaxed whitespace-pre-wrap break-all pl-[calc(0.75rem+62px+0.5rem)] pt-1 pb-0.5 select-text">
                          {event.detail}
                        </pre>
                      )}
                    </>
                  )
                  return hasDetail ? (
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(event.id)}
                      className={rowClass}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className={rowClass}>{inner}</div>
                  )
                })()}
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {filteredEvents.length > 0 && (
          <span className="timestamp">
            {filteredEvents.length === events.length
              ? `${events.length} events`
              : `${filteredEvents.length} of ${events.length}`}
          </span>
        )}
      </div>
    </SettingsSection>
  )
}
