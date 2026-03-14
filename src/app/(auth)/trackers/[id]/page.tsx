// src/app/(auth)/trackers/[id]/page.tsx
//
// Functions: TrackerDetailPage

"use client"

import clsx from "clsx"
import { useParams, useRouter } from "next/navigation"
import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { RankProgress } from "@/components/dashboard/RankProgress"
import { TorrentsTab } from "@/components/dashboard/TorrentsTab"
import { TrackerSettingsDialog } from "@/components/TrackerSettingsDialog"
import { AnalyticsTab } from "@/components/tracker-detail/AnalyticsTab"
import type { DebugData } from "@/components/tracker-detail/DebugResponseDialog"
import { DebugResponseDialog } from "@/components/tracker-detail/DebugResponseDialog"
import { PollErrorBanner } from "@/components/tracker-detail/PollErrorBanner"
import { resolveSlots } from "@/components/tracker-detail/resolve-slots"
import { TrackerDetailHeader } from "@/components/tracker-detail/TrackerDetailHeader"
import { TrackerInfoTab } from "@/components/tracker-detail/TrackerInfoTab"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { findRegistryEntry } from "@/data/tracker-registry"
import { computeDelta, hexToRgba } from "@/lib/formatters"
import type { SlotContext } from "@/lib/slot-types"
import type { GazellePlatformMeta, QbitmanageTagConfig, Snapshot, TagGroup, TrackerSummary } from "@/types/api"

type Tab = "analytics" | "info" | "torrents"

// ---------------------------------------------------------------------------
// TrackerDetailPage
// ---------------------------------------------------------------------------

export default function TrackerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [tracker, setTracker] = useState<TrackerSummary | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [allTimeSnapshots, setAllTimeSnapshots] = useState<Snapshot[]>([])
  const [days, setDays] = useState<DayRange>(30)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [pollError, setPollError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("analytics")
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([])
  const [qbitmanageConfig, setQbitmanageConfig] = useState<{ enabled: boolean; tags: QbitmanageTagConfig } | null>(null)
  const [showDebugDialog, setShowDebugDialog] = useState(false)
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)

  // Fetch tracker metadata (depends on id only)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/trackers/${id}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TrackerSummary | null) => setTracker(data))
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  // Fetch day-filtered snapshots (depends on id + days)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/trackers/${id}/snapshots?days=${days}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Snapshot[]) => setSnapshots(data))
      .catch(() => {})
    return () => controller.abort()
  }, [id, days])

  // Fetch all-time snapshots (depends on id only — for RankProgress)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/trackers/${id}/snapshots?days=0`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Snapshot[]) => setAllTimeSnapshots(data))
      .catch(() => {})
    return () => controller.abort()
  }, [id])

  // Fetch supplementary data (tag groups + settings, once on mount)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/tag-groups", { signal: controller.signal }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings", { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([tg, settings]: [TagGroup[], { qbitmanageEnabled?: boolean; qbitmanageTags?: QbitmanageTagConfig } | null]) => {
      setTagGroups(tg)
      if (settings?.qbitmanageEnabled !== undefined && settings.qbitmanageTags !== undefined) {
        setQbitmanageConfig({ enabled: settings.qbitmanageEnabled, tags: settings.qbitmanageTags })
      }
    }).catch(() => {})
    return () => controller.abort()
  }, [])

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

  async function handlePollNow() {
    setPolling(true)
    setPollError(null)
    try {
      const res = await fetch(`/api/trackers/${id}/poll`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Poll failed" }))
        setPollError((body as { error?: string }).error ?? "Poll failed")
      } else {
        const [trackerRes, snapshotsRes] = await Promise.all([
          fetch(`/api/trackers/${id}`),
          fetch(`/api/trackers/${id}/snapshots?days=${days}`),
        ])
        if (trackerRes.ok) setTracker(await trackerRes.json())
        if (snapshotsRes.ok) setSnapshots(await snapshotsRes.json())
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

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const stats = tracker?.latestStats ?? null
  const delta = useMemo(() => computeDelta(snapshots), [snapshots])

  const tc = tracker?.color || CHART_THEME.accent
  const registryEntry: TrackerRegistryEntry | undefined = tracker ? findRegistryEntry(tracker.baseUrl) : undefined

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

  if (loading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-secondary text-sm font-mono animate-loading-breathe">Loading...</p>
      </div>
    )
  }

  if (!tracker) {
    return (
      <div className="flex h-full min-h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-danger text-sm font-mono">Tracker not found.</p>
      </div>
    )
  }

  const gazelleMeta: GazellePlatformMeta | null = tracker.platformType === "gazelle" ? (tracker.platformMeta as GazellePlatformMeta | null) : null

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
      {/* ── Header ── */}
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
      />

      {/* Rank Progression */}
      <RankProgress
        userClasses={registryEntry?.userClasses ?? []}
        currentRank={stats?.group ?? null}
        snapshots={allTimeSnapshots}
        accentColor={tc}
        joinedAt={tracker.joinedAt}
      />

      {/* ── Error banners ── */}
      <PollErrorBanner
        pollError={pollError}
        lastError={tracker.lastError}
        lastPolledAt={tracker.lastPolledAt}
        onDismissPollError={() => setPollError(null)}
      />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              "px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors duration-150 cursor-pointer -mb-px whitespace-nowrap",
              activeTab === tab.key
                ? "text-primary border-b-2"
                : "text-tertiary hover:text-secondary",
            )}
            style={activeTab === tab.key ? { borderColor: tc } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
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
          trackerId={Number(id)}
          trackerName={tracker.name}
          qbtTag={tracker.qbtTag}
          accentColor={tc}
          rules={registryEntry?.rules}
          tagGroups={tagGroups}
          trackerSeedingCount={stats?.seedingCount}
          qbitmanageConfig={qbitmanageConfig}
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
