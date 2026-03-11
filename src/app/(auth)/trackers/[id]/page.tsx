"use client"

// src/app/(auth)/trackers/[id]/page.tsx
//
// Functions: computeDelta, STAT_ICONS, RankTooltip, TrackerDetailPage

import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { MetricChart } from "@/components/charts/MetricChart"
import { PercentileRadarChart } from "@/components/charts/PercentileRadarChart"
import { UploadDownloadChart } from "@/components/charts/UploadDownloadChart"
import { UploadPolarChart } from "@/components/charts/UploadPolarChart"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { RankProgress } from "@/components/dashboard/RankProgress"
import { TorrentsTab } from "@/components/dashboard/TorrentsTab"
import { TrackerHubStatus } from "@/components/TrackerHubStatus"
import { TrackerSettingsDialog } from "@/components/TrackerSettingsDialog"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import {
  DownloadArrowIcon,
  ExternalLinkSmallIcon,
  GearIcon,
  LeechingIcon,
  RatioIcon,
  SeedingIcon,
  ShareScoreIcon,
  ShieldIcon,
  StarIcon,
  TriangleWarningIcon,
  UploadArrowIcon,
  UserIcon,
} from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import { RedactedText } from "@/components/ui/RedactedText"
import { StatCard } from "@/components/ui/StatCard"
import { H1, H2 } from "@/components/ui/Typography"
import type { TrackerRegistryEntry, TrackerUserClass } from "@/data/tracker-registry"
import { findRegistryEntry } from "@/data/tracker-registry"
import { formatAccountAge, formatBytesFromString, formatJoinedDate, formatRatio, hexToRgba } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import { getHealthBadgeVariant, getHealthDescription, getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { GazellePlatformMeta, GGnPlatformMeta, QbitmanageTagConfig, Snapshot, TagGroup, TrackerSummary } from "@/types/api"

type Tab = "analytics" | "info" | "torrents"

const STAT_ICONS: Record<string, React.ReactNode> = {
  uploaded: <UploadArrowIcon width="16" height="16" />,
  downloaded: <DownloadArrowIcon width="16" height="16" />,
  ratio: <RatioIcon width="16" height="16" />,
  buffer: <ShieldIcon width="16" height="16" />,
  seeding: <SeedingIcon width="16" height="16" />,
  leeching: <LeechingIcon width="16" height="16" />,
  seedbonus: <StarIcon width="16" height="16" />,
  hitAndRuns: <TriangleWarningIcon width="16" height="16" />,
}

function computeDelta(snaps: Snapshot[]): { uploaded: string; downloaded: string } | null {
  if (snaps.length < 2) return null
  const latest = snaps[snaps.length - 1]
  const cutoff = Date.now() - 24 * 60 * 60 * 1000

  let earliest: Snapshot | null = null
  for (const s of snaps) {
    if (new Date(s.polledAt).getTime() >= cutoff) {
      earliest = s
      break
    }
  }

  if (!earliest || earliest === latest) return null

  const uploadDelta = BigInt(latest.uploadedBytes) - BigInt(earliest.uploadedBytes)
  const downloadDelta = BigInt(latest.downloadedBytes) - BigInt(earliest.downloadedBytes)

  return {
    uploaded: uploadDelta.toString(),
    downloaded: downloadDelta.toString(),
  }
}

// ---------------------------------------------------------------------------
// RankTooltip — hover shows all ranks, current rank highlighted
// ---------------------------------------------------------------------------

interface RankTooltipProps {
  currentRank: string
  userClasses: TrackerUserClass[]
  accentColor: string
}

function RankTooltip({ currentRank, userClasses, accentColor }: RankTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex">
      <Badge
        style={{
          backgroundColor: hexToRgba(accentColor, 0.15),
          color: accentColor,
        }}
      >
        <span className="flex items-center gap-1.5">
          {currentRank}
          <span
            className="cursor-help text-[9px] font-bold opacity-70 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            ?
          </span>
        </span>
      </Badge>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-elevated nm-raised-sm py-2 px-1 min-w-[200px] rounded-nm-md"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-[10px] font-sans font-medium text-tertiary uppercase tracking-wider px-3 pb-1.5">
            Ranks
          </p>
          {userClasses.map((uc) => {
            const isCurrent = uc.name.toLowerCase() === currentRank.toLowerCase()
            return (
              <div
                key={uc.name}
                className="px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-2"
                style={isCurrent ? { color: accentColor, backgroundColor: hexToRgba(accentColor, 0.1) } : {}}
              >
                <span className={isCurrent ? "font-semibold" : "text-secondary"}>
                  {uc.name}
                </span>
                {isCurrent && (
                  <span className="text-[10px]">← you</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GgnAvatar — loads avatar from GazelleGames CDN with SVG fallback
// ---------------------------------------------------------------------------

interface TrackerAvatarProps {
  trackerId: number
  accentColor: string
}

function TrackerAvatar({ trackerId, accentColor }: TrackerAvatarProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <UserIcon width="24" height="24" stroke={accentColor} />
  }

  return (
    <img
      src={`/api/trackers/${trackerId}/avatar`}
      alt="User avatar"
      width={56}
      height={56}
      className="w-full h-full object-cover rounded-nm-pill"
      onError={() => setFailed(true)}
    />
  )
}

// ---------------------------------------------------------------------------
// TrackerDetailPage
// ---------------------------------------------------------------------------

export default function TrackerDetailPage() {
  const params = useParams()
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
  const [pollLogOpen, setPollLogOpen] = useState(false)
  const [bannedOpen, setBannedOpen] = useState(false)
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([])
  const [qbitmanageConfig, setQbitmanageConfig] = useState<{ enabled: boolean; tags: QbitmanageTagConfig } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [trackersRes, snapshotsRes, allTimeRes] = await Promise.all([
        fetch("/api/trackers"),
        fetch(`/api/trackers/${id}/snapshots?days=${days}`),
        fetch(`/api/trackers/${id}/snapshots?days=0`),
      ])

      if (trackersRes.ok) {
        const allTrackers: TrackerSummary[] = await trackersRes.json()
        const found = allTrackers.find((t) => t.id === Number(id))
        setTracker(found ?? null)
      }

      if (snapshotsRes.ok) {
        const data: Snapshot[] = await snapshotsRes.json()
        setSnapshots(data)
      }

      if (allTimeRes.ok) {
        const allTimeData: Snapshot[] = await allTimeRes.json()
        setAllTimeSnapshots(allTimeData)
      }
    } catch {
      // silently ignore fetch errors; stale data stays visible
    } finally {
      setLoading(false)
    }
  }, [id, days])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    let cancelled = false
    fetch("/api/tag-groups")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TagGroup[]) => { if (!cancelled) setTagGroups(data) })
      .catch(() => {})

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { qbitmanageEnabled?: boolean; qbitmanageTags?: QbitmanageTagConfig } | null) => {
        if (data?.qbitmanageEnabled !== undefined && data.qbitmanageTags !== undefined) {
          if (!cancelled) setQbitmanageConfig({
            enabled: data.qbitmanageEnabled,
            tags: data.qbitmanageTags,
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Tint the page scrollbar to the tracker's color
  const scrollbarColor = tracker?.color || "#00d4ff"
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
        await loadData()
      }
    } catch {
      setPollError("Network error during poll")
    } finally {
      setPolling(false)
    }
  }

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const stats = tracker?.latestStats ?? null
  const delta = computeDelta(snapshots)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-secondary text-sm font-mono">Loading...</p>
      </div>
    )
  }

  if (!tracker) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-danger text-sm font-mono">Tracker not found.</p>
      </div>
    )
  }

  const lastPolledLabel = tracker.lastPolledAt
    ? new Date(tracker.lastPolledAt).toLocaleString()
    : "Never"

  const tc = tracker.color || "#00d4ff"
  const health = getTrackerHealth(tracker)
  const registryEntry: TrackerRegistryEntry | undefined = findRegistryEntry(tracker.baseUrl)
  const accountAge = formatAccountAge(tracker.joinedAt)
  const joinedDate = formatJoinedDate(tracker.joinedAt)
  const ggMeta: GGnPlatformMeta | null = tracker.platformType === "ggn" ? (tracker.platformMeta as GGnPlatformMeta | null) : null
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
        } as React.CSSProperties
      }
    >
      {/* ── Header ── */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-3">
            {/* Title row */}
            <div className="flex items-center gap-3">
              {registryEntry?.logo && (
                <img
                  src={registryEntry.logo}
                  alt=""
                  width={24}
                  height={24}
                  className="flex-shrink-0 object-contain rounded-nm-sm"
                  style={{ maxHeight: 24 }}
                  aria-hidden="true"
                />
              )}
              <H1 className="text-3xl font-bold tracking-tight">{tracker.name}</H1>
              <PulseDot status={getHealthPulseDot(health)} size="md" />
              <a
                href={tracker.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-accent transition-colors duration-150 flex-shrink-0"
                title={`Open ${tracker.name}`}
              >
                <ExternalLinkSmallIcon width="16" height="16" />
              </a>
            </div>

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getHealthBadgeVariant(health)}>
                {getHealthDescription(health)}
              </Badge>
              <Badge variant="default">{tracker.platformType}</Badge>
              {registryEntry?.language && (
                <Badge variant="default">{registryEntry.language}</Badge>
              )}
              {!tracker.isActive && (
                <Badge variant="warn">Archived</Badge>
              )}
              {/* GGn-specific status badges */}
              {ggMeta && (() => {
                return (
                  <>
                    {ggMeta.donor === true && (
                      <Badge variant="accent">Donor</Badge>
                    )}
                    {stats?.warned === true && (
                      <Badge variant="danger">Warned</Badge>
                    )}
                    {ggMeta.enabled === false && (
                      <Badge variant="danger">Disabled</Badge>
                    )}
                    {ggMeta.parked === true && (
                      <Badge variant="warn">Parked</Badge>
                    )}
                    {ggMeta.invites != null && ggMeta.invites > 0 && (
                      <Badge variant="default">{ggMeta.invites} Invites</Badge>
                    )}
                    {ggMeta.onIRC === true && (
                      <Badge variant="default">
                        <span className="flex items-center gap-1.5">
                          <PulseDot status="healthy" size="sm" />
                          IRC
                        </span>
                      </Badge>
                    )}
                  </>
                )
              })()}
              {/* Gazelle-specific status badges (RED, OPS, etc.) */}
              {gazelleMeta && (
                <>
                  {gazelleMeta.donor === true && (
                    <Badge variant="accent">Donor</Badge>
                  )}
                  {stats?.warned === true && (
                    <Badge variant="danger">Warned</Badge>
                  )}
                  {gazelleMeta.enabled === false && (
                    <Badge variant="danger">Disabled</Badge>
                  )}
                  {gazelleMeta.paranoiaText && gazelleMeta.paranoiaText !== "Off" && (
                    <Badge variant="default">Paranoia: {gazelleMeta.paranoiaText}</Badge>
                  )}
                  {gazelleMeta.notifications && gazelleMeta.notifications.messages > 0 && (
                    <Badge variant="warn">{gazelleMeta.notifications.messages} Unread</Badge>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePollNow}
              disabled={polling}
            >
              {polling ? "Polling..." : "Poll Now"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings(true)}
              aria-label="Tracker settings"
            >
              <GearIcon width="16" height="16" />
            </Button>
          </div>
        </div>

        {/* TrackerHub status */}
        {registryEntry?.trackerHubSlug && (
          <div className="my-4">
            <TrackerHubStatus
              trackerHubSlug={registryEntry.trackerHubSlug}
              statusPageUrl={registryEntry.statusPageUrl}
            />
          </div>
        )}

        {/* User Profile */}
        {stats && (stats.username || stats.group) && (
          <div
            className="nm-raised bg-elevated px-4 sm:px-6 py-5 w-full sm:w-fit rounded-nm-lg"
          >
            <div className="flex items-center gap-6">
              {/* Avatar circle */}
              <div
                className="flex items-center justify-center w-14 h-14 nm-inset-sm bg-control-bg flex-shrink-0 overflow-hidden rounded-nm-pill"
              >
                {tracker.platformType === "ggn" && tracker.remoteUserId ? (
                  <TrackerAvatar trackerId={tracker.id} accentColor={tc} />
                ) : (
                  <UserIcon width="24" height="24" stroke={tc} />
                )}
              </div>

              {/* Info column */}
              <div className="flex flex-col gap-2">
                {stats.username && (
                  <RedactedText value={stats.username} color={tc} className="text-lg font-mono text-primary font-semibold" />
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {stats.group && registryEntry?.userClasses && !isRedacted(stats.group) ? (
                    <RankTooltip
                      currentRank={stats.group}
                      userClasses={registryEntry.userClasses}
                      accentColor={tc}
                    />
                  ) : stats.group ? (
                    <Badge
                      style={{
                        backgroundColor: hexToRgba(tc, 0.15),
                        color: tc,
                      }}
                    >
                      <RedactedText value={stats.group} color={tc} />
                    </Badge>
                  ) : null}

                  {joinedDate && (
                    <span className="text-xs font-mono text-muted">
                      Joined {joinedDate}
                    </span>
                  )}

                  {accountAge && (
                    <span className="text-xs font-mono text-muted">
                      · {accountAge}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rank Progression */}
      <RankProgress
        userClasses={registryEntry?.userClasses ?? []}
        currentRank={stats?.group ?? null}
        snapshots={allTimeSnapshots}
        accentColor={tc}
      />

      {/* ── Error banners ── */}
      {pollError && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-center justify-between gap-3">
            <p className="text-danger text-sm font-mono">Poll error: {pollError}</p>
            <button
              type="button"
              onClick={() => setPollError(null)}
              className="text-danger/60 hover:text-danger transition-colors cursor-pointer flex-shrink-0 text-xs p-1 -m-1"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </Card>
      )}
      {tracker.lastError && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
              Last Error
            </p>
            {tracker.lastPolledAt && (
              <span className="text-[10px] font-mono text-muted">
                {new Date(tracker.lastPolledAt).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-danger text-sm font-mono">{tracker.lastError}</p>
        </Card>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto styled-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors duration-150 cursor-pointer -mb-px whitespace-nowrap",
              activeTab === tab.key
                ? "text-primary border-b-2"
                : "text-tertiary hover:text-secondary",
            ].join(" ")}
            style={activeTab === tab.key ? { borderColor: tc } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "analytics" && (
        <div className="flex flex-col gap-10">
          {/* GGn achievement progress */}
          {ggMeta?.achievements && (() => {
            const { userLevel, nextLevel, totalPoints, pointsToNextLvl } = ggMeta.achievements
            const earned = totalPoints - pointsToNextLvl
            const pct = totalPoints > 0 ? Math.min(100, Math.max(0, (earned / totalPoints) * 100)) : 0
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-secondary font-semibold">{userLevel}</span>
                  <span className="text-tertiary">
                    {earned.toLocaleString()} / {totalPoints.toLocaleString()} pts
                  </span>
                  <span className="text-muted">{nextLevel}</span>
                </div>
                <div
                  className="nm-inset h-2 w-full overflow-hidden rounded-nm-pill"
                >
                  <div
                    className="h-full transition-all duration-500 rounded-nm-pill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: tc,
                      boxShadow: `0 0 8px ${hexToRgba(tc, 0.5)}`,
                    }}
                  />
                </div>
                <p className="text-[10px] font-mono text-muted text-right">
                  {pointsToNextLvl.toLocaleString()} pts to {nextLevel}
                </p>
              </div>
            )
          })()}

          {/* GGn share score progress */}
          {tracker.platformType === "ggn" && latestSnapshot?.shareScore != null && (() => {
            const score = latestSnapshot.shareScore
            const maxScore = 15
            const pct = Math.min(100, Math.max(0, (score / maxScore) * 100))
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-tertiary uppercase tracking-wider font-sans font-medium text-[10px]">Share Score</span>
                  <span className="text-secondary font-semibold">{score.toFixed(2)} / {maxScore}</span>
                </div>
                <div
                  className="nm-inset h-2 w-full overflow-hidden rounded-nm-pill"
                >
                  <div
                    className="h-full transition-all duration-500 rounded-nm-pill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: tc,
                      boxShadow: `0 0 8px ${hexToRgba(tc, 0.5)}`,
                    }}
                  />
                </div>
              </div>
            )
          })()}

          {/* Stat cards row 1 */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <StatCard label="Uploaded" value={formatBytesFromString(stats?.uploadedBytes ?? null)} accentColor={tc} icon={STAT_ICONS.uploaded} />
            <StatCard label="Downloaded" value={formatBytesFromString(stats?.downloadedBytes ?? null)} accentColor={tc} icon={STAT_ICONS.downloaded} />
            <StatCard
              label="Ratio"
              value={formatRatio(stats?.ratio)}
              accentColor={tc}
              icon={STAT_ICONS.ratio}
              trend={
                stats?.ratio === null || stats?.ratio === undefined
                  ? undefined
                  : stats.ratio >= 2
                    ? "up"
                    : stats.ratio >= 1
                      ? "flat"
                      : "down"
              }
            />
            <StatCard label="Buffer" value={formatBytesFromString(latestSnapshot?.bufferBytes ?? null)} accentColor={tc} icon={STAT_ICONS.buffer} />
          </div>

          {/* Stat cards row 2 */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <StatCard label="Seeding" value={stats?.seedingCount != null ? stats.seedingCount.toLocaleString() : "—"} accentColor={tc} icon={STAT_ICONS.seeding} />
            <StatCard label="Leeching" value={stats?.leechingCount != null ? stats.leechingCount.toLocaleString() : "—"} accentColor={tc} icon={STAT_ICONS.leeching} />
            {tracker.platformType === "ggn" ? (
              <StatCard
                label="Gold"
                value={
                  latestSnapshot?.seedbonus !== null && latestSnapshot?.seedbonus !== undefined
                    ? Math.floor(latestSnapshot.seedbonus).toLocaleString("en-US")
                    : "—"
                }
                unit="Gold"
                subtitle={
                  ggMeta?.hourlyGold != null
                    ? `+${ggMeta.hourlyGold}/hr`
                    : undefined
                }
                accentColor={tc}
                icon={STAT_ICONS.seedbonus}
              />
            ) : (
              <StatCard
                label="Seedbonus"
                value={
                  latestSnapshot?.seedbonus !== null && latestSnapshot?.seedbonus !== undefined
                    ? `${Math.floor(latestSnapshot.seedbonus).toLocaleString("en-US")} BON`
                    : "—"
                }
                accentColor={tc}
                icon={STAT_ICONS.seedbonus}
              />
            )}
            <StatCard
              label="Hit & Runs"
              value={
                latestSnapshot?.hitAndRuns !== null && latestSnapshot?.hitAndRuns !== undefined
                  ? latestSnapshot.hitAndRuns
                  : "—"
              }
              accentColor={tc}
              icon={STAT_ICONS.hitAndRuns}
            />
          </div>

          {/* GGn Share Score stat card */}
          {tracker.platformType === "ggn" && (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <StatCard
                label="Share Score"
                value={
                  latestSnapshot?.shareScore != null
                    ? latestSnapshot.shareScore.toFixed(2)
                    : "—"
                }
                unit={latestSnapshot?.shareScore != null ? "/ 15" : undefined}
                accentColor={tc}
                icon={<ShareScoreIcon width="16" height="16" />}
              />
            </div>
          )}

          {/* Gazelle enrichment stat cards (RED, OPS, etc.) */}
          {gazelleMeta && (gazelleMeta.giftTokens != null || gazelleMeta.meritTokens != null || gazelleMeta.community) && (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {gazelleMeta.giftTokens != null && (
                <StatCard
                  label="FL Tokens"
                  value={gazelleMeta.giftTokens.toLocaleString()}
                  accentColor={tc}
                  icon={<StarIcon width="16" height="16" />}
                />
              )}
              {gazelleMeta.meritTokens != null && (
                <StatCard
                  label="Merit Tokens"
                  value={gazelleMeta.meritTokens.toLocaleString()}
                  accentColor={tc}
                  icon={<ShieldIcon width="16" height="16" />}
                />
              )}
              {gazelleMeta.community?.perfectFlacs != null && gazelleMeta.community.perfectFlacs > 0 && (
                <StatCard
                  label="Perfect FLACs"
                  value={gazelleMeta.community.perfectFlacs.toLocaleString()}
                  accentColor={tc}
                  icon={STAT_ICONS.uploaded}
                />
              )}
              {gazelleMeta.community?.snatched != null && (
                <StatCard
                  label="Snatched"
                  value={gazelleMeta.community.snatched.toLocaleString()}
                  accentColor={tc}
                  icon={<DownloadArrowIcon width="16" height="16" />}
                />
              )}
            </div>
          )}

          {/* Gazelle community stats (RED, OPS, etc.) */}
          {gazelleMeta?.community && (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {gazelleMeta.community.uploaded > 0 && (
                <StatCard
                  label="Torrents Uploaded"
                  value={gazelleMeta.community.uploaded.toLocaleString()}
                  accentColor={tc}
                  icon={<UploadArrowIcon width="16" height="16" />}
                />
              )}
              {gazelleMeta.community.requestsFilled > 0 && (
                <StatCard
                  label="Requests Filled"
                  value={gazelleMeta.community.requestsFilled.toLocaleString()}
                  accentColor={tc}
                  icon={STAT_ICONS.seeding}
                />
              )}
              {gazelleMeta.community.groups > 0 && (
                <StatCard
                  label="Groups"
                  value={gazelleMeta.community.groups.toLocaleString()}
                  accentColor={tc}
                  icon={STAT_ICONS.buffer}
                />
              )}
              {gazelleMeta.community.invited > 0 && (
                <StatCard
                  label="Invited"
                  value={gazelleMeta.community.invited.toLocaleString()}
                  accentColor={tc}
                  icon={<UserIcon width="16" height="16" />}
                />
              )}
            </div>
          )}

          {/* GGn Active Buffs */}
          {ggMeta?.buffs && (() => {
            const activeBuffs = Object.entries(ggMeta.buffs).filter(([, v]) => v !== 1)
            if (activeBuffs.length === 0) return null
            return (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Active Buffs</p>
                <div className="flex flex-wrap gap-2">
                  {activeBuffs.map(([key, val]) => {
                    const label = `${key.charAt(0).toUpperCase()}${key.slice(1)} ${val}x`
                    const isBoost = val > 1
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center px-2.5 py-1 font-mono text-xs nm-inset-sm rounded-nm-pill"
                        style={{
                          color: isBoost ? tc : "var(--color-warn)",
                          backgroundColor: isBoost
                            ? hexToRgba(tc, 0.1)
                            : "var(--color-warn-dim)",
                        }}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <hr className="border-border" />

          {/* Poll log */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPollLogOpen((o) => !o)}
              className="flex items-center gap-2 text-xs text-tertiary font-mono hover:text-secondary transition-colors duration-150 cursor-pointer w-fit"
            >
              <ChevronToggle expanded={pollLogOpen} />
              Last polled: {lastPolledLabel}
            </button>
            {pollLogOpen && (
              <div
                className="nm-inset-sm bg-control-bg overflow-hidden overflow-x-auto styled-scrollbar rounded-nm-md"
              >
                {tracker.lastError && (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-danger border-b border-border whitespace-nowrap min-w-fit">
                    <span className="flex-shrink-0">✕</span>
                    <span className="text-tertiary">{lastPolledLabel}</span>
                    <span className="truncate">{tracker.lastError}</span>
                  </div>
                )}
                {snapshots.length === 0 ? (
                  <p className="px-4 py-3 text-xs font-mono text-muted">No poll history yet.</p>
                ) : (
                  [...snapshots]
                    .reverse()
                    .slice(0, 10)
                    .map((snap, i) => (
                      <div
                        key={snap.polledAt}
                        className={[
                          "flex items-center gap-4 px-4 py-2 text-xs font-mono whitespace-nowrap min-w-fit",
                          i % 2 === 0 ? "" : "bg-elevated",
                        ].join(" ")}
                      >
                        <span className="text-success flex-shrink-0">✓</span>
                        <span className="text-tertiary flex-shrink-0 w-[160px]">
                          {new Date(snap.polledAt).toLocaleString()}
                        </span>
                        <span className="text-secondary">
                          {formatBytesFromString(snap.uploadedBytes)} ↑
                        </span>
                        <span className="text-secondary">
                          {formatBytesFromString(snap.downloadedBytes)} ↓
                        </span>
                        <span className="text-secondary">
                          {snap.ratio !== null ? `${snap.ratio.toFixed(2)}x` : "—"}
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Charts + sidebar two-column layout */}
          <div className="flex flex-col md:flex-row gap-8">
            {/* Charts column */}
            <div className="flex-1 flex flex-col gap-8 min-w-0">
              {/* Upload/Download chart */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                  Upload / Download History
                </H2>
                {delta && (
                  <p className="text-xs font-mono text-tertiary">
                    24h: <span className="text-primary">{formatBytesFromString(delta.uploaded)}</span> ↑{" "}
                    <span className="text-primary">{formatBytesFromString(delta.downloaded)}</span> ↓
                  </p>
                )}
                <UploadDownloadChart snapshots={snapshots} accentColor={tc} showDataZoom={days >= 30 || days === 0} />
              </Card>

              {/* Ratio */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Ratio</H2>
                <MetricChart metric="ratio" snapshots={snapshots} accentColor={tc} />
              </Card>

              {/* Buffer */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Buffer</H2>
                <MetricChart metric="buffer" snapshots={snapshots} accentColor={tc} />
              </Card>

              {/* Seedbonus / Gold */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                  {tracker.platformType === "ggn" ? "Gold" : "Seedbonus"}
                </H2>
                <MetricChart metric="seedbonus" snapshots={snapshots} accentColor={tc} />
              </Card>

              {/* GGn Share Score chart */}
              {tracker.platformType === "ggn" && (
                <Card trackerColor={tc} className="flex flex-col gap-4">
                  <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Share Score</H2>
                  <MetricChart metric="shareScore" snapshots={snapshots} accentColor={tc} />
                </Card>
              )}

              {/* Gazelle Percentile Radar */}
              {gazelleMeta?.ranks && (
                <Card trackerColor={tc} className="flex flex-col gap-4">
                  <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Percentile Ranks</H2>
                  <p className="text-xs font-mono text-tertiary">
                    Your standing relative to all users — {gazelleMeta.ranks.overall}th percentile overall
                  </p>
                  <PercentileRadarChart ranks={gazelleMeta.ranks} accentColor={tc} />
                </Card>
              )}

              {/* Seeding Count */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Seeding Count</H2>
                <MetricChart metric="seedingCount" snapshots={snapshots} accentColor={tc} />
              </Card>

              {/* Daily Activity */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Daily Activity</H2>
                <MetricChart metric="dailyDelta" snapshots={snapshots} accentColor={tc} />
              </Card>

              {/* Upload by Time of Day */}
              <Card trackerColor={tc} className="flex flex-col gap-4">
                <H2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                  Upload by Time of Day
                </H2>
                <UploadPolarChart snapshots={snapshots} accentColor={tc} />
              </Card>
            </div>

            {/* Sticky sidebar */}
            <DayRangeSidebar days={days} onChange={setDays} accentColor={tc} />
          </div>

        </div>
      )}

      {activeTab === "info" && (
        <div className="flex flex-col gap-10">
          {/* Description */}
          {registryEntry?.description && (
            <div className="flex flex-col gap-2">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">About</H2>
              <p className="text-sm font-sans text-secondary leading-relaxed max-w-prose">
                {registryEntry.description}
              </p>
              {registryEntry.specialty && (
                <p className="text-xs font-mono text-muted mt-1">Specialty: {registryEntry.specialty}</p>
              )}
            </div>
          )}

          {/* Key Rules */}
          {registryEntry?.rules && (
            <div className="flex flex-col gap-3">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Key Rules</H2>
              <div
                className="nm-inset-sm bg-control-bg overflow-hidden rounded-nm-md"
              >
                {[
                  { label: "Minimum Ratio", value: registryEntry.rules.minimumRatio > 0 ? registryEntry.rules.minimumRatio.toString() : "None", tip: "Your upload/download ratio must stay above this threshold to avoid demotion or account restrictions." },
                  { label: "Seed Time", value: registryEntry.rules.seedTimeHours > 0 ? (registryEntry.rules.seedTimeHours % 24 === 0 ? `${registryEntry.rules.seedTimeHours / 24} days` : `${registryEntry.rules.seedTimeHours} hours`) : "None", tip: "The minimum amount of time you must seed each torrent after downloading it." },
                  { label: "Fulfillment Period", value: registryEntry.rules.fulfillmentPeriodHours != null ? (registryEntry.rules.fulfillmentPeriodHours % 24 === 0 ? `${registryEntry.rules.fulfillmentPeriodHours / 24} days` : `${registryEntry.rules.fulfillmentPeriodHours} hours`) : null, tip: "The total window you have to complete the required seed time. Seeding doesn't have to be continuous, but must be met within this period." },
                  { label: "Login Interval", value: `${registryEntry.rules.loginIntervalDays} days`, tip: "How long you can go without logging in before your account is parked, pruned, or disabled." },
                  { label: "H&R Ban Limit", value: registryEntry.rules.hnrBanLimit != null ? `${registryEntry.rules.hnrBanLimit} warnings` : null, tip: "The number of Hit & Run violations allowed before your account is banned or download privileges are revoked." },
                ].filter((r) => r.value != null).map((rule, i) => (
                  <div
                    key={rule.label}
                    className={[
                      "flex items-center justify-between px-5 py-3.5",
                      i > 0 ? "border-t border-border" : "",
                    ].join(" ")}
                  >
                    <span className="text-sm font-sans text-tertiary flex items-center gap-1.5">
                      {rule.label}
                      <span
                        className="cursor-help text-[9px] font-bold opacity-50 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current hover:opacity-80 transition-opacity"
                        title={rule.tip}
                      >
                        ?
                      </span>
                    </span>
                    <span className="text-base font-mono font-semibold text-primary">{rule.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content categories */}
          {registryEntry?.contentCategories && registryEntry.contentCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Content</H2>
              <div className="flex flex-wrap items-center gap-2">
                {registryEntry.contentCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-3 py-1 font-mono text-xs text-tertiary nm-inset-sm bg-control-bg rounded-nm-pill"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {registryEntry?.stats && (registryEntry.stats.userCount || registryEntry.stats.torrentCount) && (
            <div className="flex flex-col gap-3">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Site Stats</H2>
              <div className="flex flex-wrap gap-6">
                {registryEntry.stats.userCount != null && (
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-mono font-semibold text-primary">
                      {registryEntry.stats.userCount.toLocaleString()}
                    </span>
                    <span className="text-xs font-sans text-tertiary">
                      Users
                      {registryEntry.stats.activeUsers != null && (
                        <span className="text-muted ml-1">
                          ({registryEntry.stats.activeUsers.toLocaleString()} active)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {registryEntry.stats.torrentCount != null && (
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-mono font-semibold text-primary">
                      {registryEntry.stats.torrentCount.toLocaleString()}
                    </span>
                    <span className="text-xs font-sans text-tertiary">Torrents</span>
                  </div>
                )}
                {registryEntry.stats.seedSize && (
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-mono font-semibold text-primary">
                      {registryEntry.stats.seedSize}
                    </span>
                    <span className="text-xs font-sans text-tertiary">Seed Size</span>
                  </div>
                )}
                {registryEntry.stats.statsUpdatedAt && (
                  <span className="text-[10px] font-mono text-muted self-end">
                    Updated {registryEntry.stats.statsUpdatedAt}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* User Ranks */}
          {registryEntry?.userClasses && registryEntry.userClasses.length > 0 && (
            <div className="flex flex-col gap-3">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">User Ranks</H2>
              <div
                className="nm-inset-sm bg-control-bg overflow-hidden rounded-nm-md"
              >
                {registryEntry.userClasses.map((uc, i) => {
                  const isCurrent = stats?.group?.toLowerCase() === uc.name.toLowerCase()
                  return (
                    <div
                      key={uc.name}
                      className={[
                        "flex items-center justify-between px-5 py-3",
                        i > 0 ? "border-t border-border" : "",
                      ].join(" ")}
                      style={isCurrent ? { backgroundColor: hexToRgba(tc, 0.08) } : {}}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={[
                            "text-sm font-mono",
                            isCurrent ? "font-semibold" : "text-secondary",
                          ].join(" ")}
                          style={isCurrent ? { color: tc } : {}}
                        >
                          {uc.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono" style={{ color: tc }}>← you</span>
                        )}
                      </div>
                      {uc.requirements && (
                        <span className="text-xs font-mono text-muted">{uc.requirements}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Release Groups */}
          {registryEntry?.releaseGroups && registryEntry.releaseGroups.length > 0 && (
            <div className="flex flex-col gap-2">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Release Groups</H2>
              <div className="flex flex-wrap gap-2">
                {registryEntry.releaseGroups.map((g) => {
                  const name = typeof g === "string" ? g : g.name
                  const desc = typeof g === "string" ? undefined : g.description
                  return (
                    <Badge key={name} variant="accent" title={desc}>
                      {name}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notable Members */}
          {registryEntry?.notableMembers && registryEntry.notableMembers.length > 0 && (
            <div className="flex flex-col gap-2">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Notable Members</H2>
              <div className="flex flex-wrap gap-2">
                {registryEntry.notableMembers.map((m) => (
                  <Badge key={m} variant="default">{m}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Banned Groups (accordion) */}
          {registryEntry?.bannedGroups && registryEntry.bannedGroups.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-sans font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:text-secondary transition-colors"
                onClick={() => setBannedOpen((o) => !o)}
              >
                <ChevronToggle expanded={bannedOpen} />
                Banned Groups
                <span className="text-muted font-mono normal-case">({registryEntry.bannedGroups.length})</span>
              </button>
              {bannedOpen && (
                <div className="flex flex-wrap gap-2">
                  {registryEntry.bannedGroups.map((g) => (
                    <Badge key={g} variant="danger">{g}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full Rules */}
          {registryEntry?.rules?.fullRulesMarkdown && (
            <div className="flex flex-col gap-3">
              <H2 className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">Full Rules</H2>
              <div
                className="nm-inset-sm bg-control-bg px-5 py-4 text-sm font-sans text-secondary leading-relaxed whitespace-pre-wrap rounded-nm-md"
              >
                {registryEntry.rules.fullRulesMarkdown}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "torrents" && (
        <TorrentsTab
          trackerId={Number(id)}
          trackerName={tracker.name}
          qbtTag={tracker.qbtTag}
          accentColor={tc}
          rules={registryEntry?.rules}
          tagGroups={tagGroups}
          qbitmanageConfig={qbitmanageConfig}
        />
      )}

      <TrackerSettingsDialog
        key={tracker.id}
        open={showSettings}
        tracker={tracker}
        onClose={() => setShowSettings(false)}
        onUpdated={() => loadData()}
      />
    </div>
  )
}
