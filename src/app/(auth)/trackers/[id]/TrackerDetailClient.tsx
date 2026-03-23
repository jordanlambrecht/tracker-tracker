// src/app/(auth)/trackers/[id]/TrackerDetailClient.tsx
//
// Functions: TrackerDetailClient

"use client"

import clsx from "clsx"
import { useRouter, useSearchParams } from "next/navigation"
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { RankProgress } from "@/components/dashboard/RankProgress"
import { TorrentsTab } from "@/components/dashboard/TorrentsTab"
import { TrackerSettingsDialog } from "@/components/TrackerSettingsDialog"
import { AnalyticsTab } from "@/components/tracker-detail/AnalyticsTab"
import type { DebugData } from "@/components/tracker-detail/DebugResponseDialog"
import { DebugResponseDialog } from "@/components/tracker-detail/DebugResponseDialog"
import { resolveSlots } from "@/components/tracker-detail/resolve-slots"
import { TrackerDetailHeader } from "@/components/tracker-detail/TrackerDetailHeader"
import { TrackerInfoTab } from "@/components/tracker-detail/TrackerInfoTab"
import { TrackerStatusBanner } from "@/components/tracker-detail/TrackerStatusBanner"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { findRegistryEntry } from "@/data/tracker-registry"
import { useTrackerTorrents } from "@/hooks/useTrackerTorrents"
import { computeDelta, hexToRgba } from "@/lib/formatters"
import type { SlotContext } from "@/lib/slot-types"
import type {
  GazellePlatformMeta,
  QbitmanageTagConfig,
  Snapshot,
  TagGroup,
  TrackerSummary,
} from "@/types/api"

type Tab = "analytics" | "info" | "torrents"

const VALID_TABS: Tab[] = ["analytics", "info", "torrents"]

interface TrackerDetailClientProps {
  trackerId: number
  initialTracker: TrackerSummary
  initialAllTimeSnapshots: Snapshot[]
  initialTagGroups: TagGroup[]
  initialQbitmanageConfig: { enabled: boolean; tags: QbitmanageTagConfig } | null
}

export function TrackerDetailClient({
  trackerId,
  initialTracker,
  initialAllTimeSnapshots,
  initialTagGroups,
  initialQbitmanageConfig,
}: TrackerDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = String(trackerId)

  const initialTab = VALID_TABS.includes(searchParams.get("tab") as Tab)
    ? (searchParams.get("tab") as Tab)
    : "analytics"

  const [tracker, setTracker] = useState<TrackerSummary>(initialTracker)
  const [allTimeSnapshots, setAllTimeSnapshots] = useState<Snapshot[]>(initialAllTimeSnapshots)
  const tagGroups = initialTagGroups
  const qbitmanageConfig = initialQbitmanageConfig
  const [days, setDays] = useState<DayRange>(30)
  const [polling, setPolling] = useState(false)
  const [pollError, setPollError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [showDebugDialog, setShowDebugDialog] = useState(false)
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)
  const [pauseLoading, setPauseLoading] = useState(false)

  const torrentData = useTrackerTorrents({
    trackerId,
    qbtTag: tracker.qbtTag,
    rules: findRegistryEntry(tracker.baseUrl)?.rules,
    tagGroups,
    trackerSeedingCount: tracker.latestStats?.seedingCount,
    qbitmanageConfig,
  })

  const snapshots = useMemo(() => {
    if (days === 0) return allTimeSnapshots
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    return allTimeSnapshots.filter((s) => s.polledAt >= since)
  }, [allTimeSnapshots, days])

  // Tint the page scrollbar to the tracker's color
  const scrollbarColor = tracker?.color || CHART_THEME.accent
  useEffect(() => {
    const main = document.querySelector("main.themed-scrollbar") as HTMLElement | null
    if (!main) return
    main.style.setProperty("--scrollbar-color", hexToRgba(scrollbarColor, 0.4))
    main.style.setProperty("--scrollbar-hover", hexToRgba(scrollbarColor, 0.6))
    main.style.scrollbarColor = `${hexToRgba(scrollbarColor, 0.4)} transparent`
    return () => {
      main.style.removeProperty("--scrollbar-color")
      main.style.removeProperty("--scrollbar-hover")
      main.style.scrollbarColor = ""
    }
  }, [scrollbarColor])

  async function handleResume() {
    setPollError(null)
    try {
      const res = await fetch(`/api/trackers/${id}/resume`, { method: "POST" })
      if (res.ok) {
        const trackerRes = await fetch(`/api/trackers/${id}`)
        if (trackerRes.ok) setTracker(await trackerRes.json())
      } else {
        const body = await res.json().catch(() => ({ error: "Resume failed" }))
        setPollError((body as { error?: string }).error ?? "Failed to resume polling")
      }
    } catch {
      setPollError("Network error while resuming polling")
    }
  }

  async function handleTogglePause() {
    setPauseLoading(true)
    const wasPaused = !!tracker.userPausedAt
    const originalUserPausedAt = tracker.userPausedAt

    setTracker((prev) => ({
      ...prev,
      userPausedAt: wasPaused ? null : new Date().toISOString(),
      ...(wasPaused ? { pausedAt: null, consecutiveFailures: 0, lastError: null } : {}),
    }))

    try {
      const res = await fetch(`/api/trackers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollingPaused: !wasPaused }),
      })
      if (!res.ok) throw new Error("Failed to toggle pause")
      const trackerRes = await fetch(`/api/trackers/${id}`)
      if (trackerRes.ok) setTracker(await trackerRes.json())
    } catch {
      setTracker((prev) => ({ ...prev, userPausedAt: originalUserPausedAt }))
      setPollError("Failed to toggle pause — please try again")
    } finally {
      setPauseLoading(false)
    }
  }

  async function handlePollNow() {
    setPolling(true)
    setPollError(null)
    try {
      const res = await fetch(`/api/trackers/${id}/poll`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Poll failed" }))
        setPollError((body as { error?: string }).error ?? "Poll failed")
      } else {
        const [trackerRes, allTimeRes] = await Promise.all([
          fetch(`/api/trackers/${id}`),
          fetch(`/api/trackers/${id}/snapshots?days=0`),
        ])
        if (trackerRes.ok) setTracker(await trackerRes.json())
        if (allTimeRes.ok) setAllTimeSnapshots(await allTimeRes.json())
      }
    } catch {
      setPollError("Network error during poll")
    } finally {
      setPolling(false)
    }
  }

  async function handleDebugPoll() {
    setDebugLoading(true)
    setDebugError(null)
    setDebugData(null)
    setShowDebugDialog(true)
    try {
      const res = await fetch(`/api/trackers/${id}/debug`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Debug poll failed" }))
        setDebugError((body as { error?: string }).error ?? "Debug poll failed")
      } else {
        setDebugData(await res.json())
      }
    } catch {
      setDebugError("Network error during debug poll")
    } finally {
      setDebugLoading(false)
    }
  }

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === "analytics") {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", tab)
    }
    window.history.replaceState(null, "", url.pathname + url.search)
  }, [])

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const stats = tracker?.latestStats ?? null
  const delta = useMemo(() => computeDelta(snapshots), [snapshots])

  const tc = tracker?.color || CHART_THEME.accent
  const registryEntry: TrackerRegistryEntry | undefined = tracker
    ? findRegistryEntry(tracker.baseUrl)
    : undefined

  const { statCardSlots, badgeSlots, progressSlots } = useMemo(() => {
    if (!tracker) return { statCardSlots: [], badgeSlots: [], progressSlots: [] }
    const ctx: SlotContext = {
      tracker,
      latestSnapshot,
      snapshots,
      meta: tracker.platformMeta as SlotContext["meta"],
      registry: registryEntry,
      accentColor: tc,
    }
    const resolved = resolveSlots(ctx)
    return {
      statCardSlots: resolved.get("stat-card") ?? [],
      badgeSlots: resolved.get("badge") ?? [],
      progressSlots: resolved.get("progress") ?? [],
    }
  }, [tracker, latestSnapshot, snapshots, registryEntry, tc])

  const gazelleMeta: GazellePlatformMeta | null =
    tracker.platformType === "gazelle" ? (tracker.platformMeta as GazellePlatformMeta | null) : null

  const tabs: { key: Tab; label: string }[] = [
    { key: "analytics", label: "Data & Analytics" },
    { key: "info", label: "Tracker Info" },
    { key: "torrents", label: "Torrents" },
  ]

  return (
    <div
      className="flex flex-col gap-10 max-w-6xl mx-auto pb-24"
      style={
        {
          "--tracker-color": tc,
          "--tracker-color-dim": hexToRgba(tc, 0.15),
          "--tracker-color-glow": hexToRgba(tc, 0.25),
        } as CSSProperties
      }
    >
      {/* Header */}
      <TrackerDetailHeader
        tracker={tracker}
        stats={stats}
        registryEntry={registryEntry}
        accentColor={tc}
        polling={polling}
        onPollNow={handlePollNow}
        onOpenSettings={() => setShowSettings(true)}
        onDebugPoll={handleDebugPoll}
        debugLoading={debugLoading}
        badgeSlots={badgeSlots}
        onTogglePause={handleTogglePause}
        pauseLoading={pauseLoading}
      />

      {/* Rank Progression */}
      <RankProgress
        userClasses={registryEntry?.userClasses ?? []}
        currentRank={stats?.group ?? null}
        snapshots={allTimeSnapshots}
        accentColor={tc}
        joinedAt={tracker.joinedAt}
      />

      {/* Error / pause banners */}
      <TrackerStatusBanner
        tracker={tracker}
        pollError={pollError}
        onDismissPollError={() => setPollError(null)}
        onResume={handleResume}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={clsx(
              "px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors duration-150 cursor-pointer -mb-px whitespace-nowrap",
              activeTab === tab.key
                ? "text-primary border-b-2"
                : "text-tertiary hover:text-secondary"
            )}
            style={activeTab === tab.key ? { borderColor: tc } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "analytics" && (
        <AnalyticsTab
          tracker={tracker}
          snapshots={snapshots}
          stats={stats}
          latestSnapshot={latestSnapshot}
          gazelleMeta={gazelleMeta}
          accentColor={tc}
          days={days}
          onDaysChange={setDays}
          delta={delta}
          minimumRatio={registryEntry?.rules?.minimumRatio}
          statCardSlots={statCardSlots}
          progressSlots={progressSlots}
        />
      )}

      {activeTab === "info" && (
        <TrackerInfoTab registryEntry={registryEntry} stats={stats} accentColor={tc} />
      )}

      {activeTab === "torrents" && (
        <TorrentsTab
          trackerName={tracker.name}
          qbtTag={tracker.qbtTag}
          accentColor={tc}
          data={torrentData}
          trackerSeedingCount={stats?.seedingCount}
        />
      )}

      <TrackerSettingsDialog
        key={tracker.id}
        open={showSettings}
        tracker={tracker}
        onClose={() => setShowSettings(false)}
        onUpdated={async () => {
          const res = await fetch(`/api/trackers/${id}`)
          if (!res.ok) return
          const updated = await res.json()
          if (!updated.isActive) {
            router.push("/")
            return
          }
          setTracker(updated)
        }}
      />

      <DebugResponseDialog
        open={showDebugDialog}
        loading={debugLoading}
        data={debugData}
        error={debugError}
        onClose={() => setShowDebugDialog(false)}
      />
    </div>
  )
}
