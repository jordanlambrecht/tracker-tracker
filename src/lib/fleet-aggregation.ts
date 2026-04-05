// src/lib/fleet-aggregation.ts
//
// Functions: computeFleetAggregation

import { buildActivityMatrix } from "@/components/charts/lib/chart-transforms"
import {
  AGE_BUCKETS,
  type AgeBucket,
  type Bucket,
  type FleetStats,
  normalizeCategory,
  parseTorrentTags,
  RATIO_BUCKETS,
  SEED_TIME_BUCKETS,
  SEEDING_STATES,
  STALE_THRESHOLD_MS,
  type TorrentRaw,
  type TrackerTag,
  toMonthKey,
} from "@/lib/fleet"

// Re-export types used by callers so they don't need to import from fleet.ts
export type { FleetStats, TorrentRaw, TrackerTag }

const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Named output element types
// ---------------------------------------------------------------------------

export interface TrackerHealthMetric {
  name: string
  color: string
  torrentCount: number
  avgRatio: number
  uploadSpeedSum: number
  freshnessPct: number
  avgSeedTimeDays: number
}

export interface TrackerCategoryStorage {
  tracker: string
  categories: { name: string; count: number; totalSize: number }[]
}

export interface TrackerCategoryCount {
  tracker: string
  categories: { name: string; count: number }[]
}

export interface CrossSeedNode {
  id: string
  name: string
  color: string
  torrentCount: number
  crossSeeded: number
}

export interface CrossSeedEdge {
  source: string
  target: string
  weight: number
}

export interface TrackerSizes {
  tag: string
  name: string
  color: string
  sizes: number[]
}

export interface AgeTimelineEntry {
  name: string
  color: string
  months: { month: string; count: number }[]
}

export interface CategoryTimelineEntry {
  category: string
  months: { month: string; count: number }[]
}

export interface AgeBandEntry {
  name: string
  color: string
  counts: number[]
  total: number
  avgDays: number
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface FleetAggregation {
  stats: FleetStats & { torrentCount: number }

  ratioDistribution: { label: string; count: number; min: number; max: number }[]

  seedTimeDistribution: { label: string; count: number; color: string; max: number }[]

  crossSeed: { crossSeeded: number; unique: number; total: number }

  activityGrid: { data: [number, number, number][]; maxCount: number }

  trackerHealth: TrackerHealthMetric[]

  storageByTrackerCategory: TrackerCategoryStorage[]

  categoryBreakdown: TrackerCategoryCount[]

  crossSeedNetwork: { nodes: CrossSeedNode[]; edges: CrossSeedEdge[] }

  sizesByTracker: TrackerSizes[]

  ageTimeline: AgeTimelineEntry[]

  categoryTimeline: CategoryTimelineEntry[]

  ageBands: AgeBandEntry[]
}

// ---------------------------------------------------------------------------
// Internal accumulator types
// ---------------------------------------------------------------------------

interface TrackerAccumulator {
  tag: string
  name: string
  color: string
  torrentCount: number
  ratioSum: number
  validRatioCount: number
  uploadSpeedSum: number
  seedTimeDaysSum: number
  freshnessCount: number
  sizes: number[]
  // category -> { count, totalSize }
  categoryStorage: Map<string, { count: number; totalSize: number }>
  // monthKey -> count
  monthCounts: Map<string, number>
  // age bucket counts
  ageCounts: number[]
  ageTotalDays: number
}

// ---------------------------------------------------------------------------
// Main aggregation function -- single O(n) pass
// ---------------------------------------------------------------------------

export function computeFleetAggregation(
  torrents: TorrentRaw[],
  trackerTags: TrackerTag[],
  crossSeedTags: string[]
): FleetAggregation {
  const now = Date.now()
  const nowSec = now / 1000

  // Precompute lookup structures
  const crossSeedSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
  const trackerTagMap = new Map<string, TrackerTag>()
  for (const tt of trackerTags) trackerTagMap.set(tt.tag.toLowerCase(), tt)

  // Initialize per-tracker accumulators
  const trackerAccMap = new Map<string, TrackerAccumulator>()
  for (const tt of trackerTags) {
    trackerAccMap.set(tt.tag.toLowerCase(), {
      tag: tt.tag,
      name: tt.name,
      color: tt.color,
      torrentCount: 0,
      ratioSum: 0,
      validRatioCount: 0,
      uploadSpeedSum: 0,
      seedTimeDaysSum: 0,
      freshnessCount: 0,
      sizes: [],
      categoryStorage: new Map(),
      monthCounts: new Map(),
      ageCounts: new Array(AGE_BUCKETS.length).fill(0) as number[],
      ageTotalDays: 0,
    })
  }

  // Initialize ratio bucket counters
  const ratioCounts = new Array(RATIO_BUCKETS.length).fill(0) as number[]

  // Initialize seed time bucket counters
  const seedTimeCounts = new Array(SEED_TIME_BUCKETS.length).fill(0) as number[]

  // Stats accumulators
  let totalSeeding = 0
  let totalLeeching = 0
  let fleetUploadSpeed = 0
  let fleetDownloadSpeed = 0
  let totalLibrarySize = 0
  let crossSeededCount = 0
  let staleCount = 0

  // Activity matrix timestamps
  const addedOnTimestamps: number[] = []

  // Cross-seed network: torrent name -> set of tracker tags it appears on
  const nameToTrackers = new Map<string, Set<string>>()

  // Category timeline: category -> monthKey -> count
  const categoryMonthMap = new Map<string, Map<string, number>>()

  // ---------------------------------------------------------------------------
  // Single pass
  // ---------------------------------------------------------------------------

  for (const torrent of torrents) {
    // Parse tags once
    const parsedTags = parseTorrentTags(torrent.tags)
    const isCrossSeed = crossSeedSet.size > 0 && parsedTags.some((t) => crossSeedSet.has(t))

    // Find matching tracker tag (first match wins)
    const matchedTrackerTag =
      parsedTags.find((t) => !crossSeedSet.has(t) && trackerTagMap.has(t)) ?? null

    // -- Stats --
    const isSeeding = SEEDING_STATES.has(torrent.state)
    if (isSeeding) totalSeeding++
    else totalLeeching++
    fleetUploadSpeed += torrent.upspeed
    fleetDownloadSpeed += torrent.dlspeed
    totalLibrarySize += torrent.size
    if (torrent.last_activity > 0 && now - torrent.last_activity * 1000 > STALE_THRESHOLD_MS) {
      staleCount++
    }
    if (isCrossSeed) crossSeededCount++

    // -- Ratio bucket --
    // qBT returns ratio: -1 for infinite ratio (zero downloads, i.e. cross-seeded).
    // Exclude these from the distribution since they don't have a meaningful ratio.
    // Cross-seed coverage is shown by the dedicated cross-seed donut chart.
    if (torrent.ratio >= 0) {
      const rBucketIdx = RATIO_BUCKETS.findIndex((b: Bucket) => torrent.ratio < b.max)
      ratioCounts[rBucketIdx === -1 ? RATIO_BUCKETS.length - 1 : rBucketIdx]++
    }

    // -- Seed time bucket (seeding torrents only) --
    if (isSeeding) {
      const sBucketIdx = SEED_TIME_BUCKETS.findIndex((b: Bucket) => torrent.seeding_time < b.max)
      seedTimeCounts[sBucketIdx === -1 ? SEED_TIME_BUCKETS.length - 1 : sBucketIdx]++
    }

    // -- Activity matrix --
    if (torrent.added_on > 0) {
      addedOnTimestamps.push(torrent.added_on)
    }

    // -- Category timeline --
    if (torrent.added_on > 0) {
      const category = normalizeCategory(torrent.category)
      const monthKey = toMonthKey(torrent.added_on)
      const catMap = categoryMonthMap.get(category) ?? new Map<string, number>()
      catMap.set(monthKey, (catMap.get(monthKey) ?? 0) + 1)
      categoryMonthMap.set(category, catMap)
    }

    // -- Cross-seed network tracker matching (exclude cross-seed tags) --
    const networkTrackerTags = parsedTags.filter(
      (t) => !crossSeedSet.has(t) && trackerTagMap.has(t)
    )
    if (networkTrackerTags.length > 0) {
      const existing = nameToTrackers.get(torrent.name) ?? new Set<string>()
      for (const tag of networkTrackerTags) existing.add(tag)
      nameToTrackers.set(torrent.name, existing)
    }

    // -- Per-tracker accumulators --
    if (matchedTrackerTag !== null) {
      const acc = trackerAccMap.get(matchedTrackerTag)
      if (acc) {
        acc.torrentCount++
        if (torrent.ratio >= 0) {
          acc.ratioSum += torrent.ratio
          acc.validRatioCount++
        }
        acc.uploadSpeedSum += torrent.upspeed
        acc.seedTimeDaysSum += torrent.seeding_time / 86400
        if (torrent.last_activity > 0 && now - torrent.last_activity * 1000 < FRESHNESS_WINDOW_MS) {
          acc.freshnessCount++
        }
        acc.sizes.push(torrent.size)

        // Category storage
        const cat = normalizeCategory(torrent.category)
        const catEntry = acc.categoryStorage.get(cat) ?? { count: 0, totalSize: 0 }
        catEntry.count++
        catEntry.totalSize += torrent.size
        acc.categoryStorage.set(cat, catEntry)

        // Age timeline
        if (torrent.added_on > 0) {
          const monthKey = toMonthKey(torrent.added_on)
          acc.monthCounts.set(monthKey, (acc.monthCounts.get(monthKey) ?? 0) + 1)
        }

        // Age bands
        if (torrent.added_on > 0) {
          const ageDays = (nowSec - torrent.added_on) / 86400
          if (ageDays >= 0) {
            acc.ageTotalDays += ageDays
            const idx = AGE_BUCKETS.findIndex((b: AgeBucket) => ageDays < b.maxDays)
            acc.ageCounts[idx === -1 ? AGE_BUCKETS.length - 1 : idx]++
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Finalize after the pass
  // ---------------------------------------------------------------------------

  const torrentCount = torrents.length

  // Stats
  const stats: FleetAggregation["stats"] = {
    torrentCount,
    totalSeeding,
    totalLeeching,
    fleetUploadSpeed,
    fleetDownloadSpeed,
    totalLibrarySize,
    crossSeedPercent: torrentCount > 0 ? (crossSeededCount / torrentCount) * 100 : 0,
    staleCount,
  }

  // Ratio distribution
  const ratioDistribution = RATIO_BUCKETS.map((b: Bucket, i: number) => ({
    label: b.label,
    count: ratioCounts[i],
    min: i === 0 ? 0 : RATIO_BUCKETS[i - 1].max,
    max: b.max,
  }))

  // Seed time distribution
  const seedTimeDistribution = SEED_TIME_BUCKETS.map((b: Bucket, i: number) => ({
    label: b.label,
    count: seedTimeCounts[i],
    color: b.color,
    max: b.max,
  }))

  // Cross-seed totals
  const crossSeed = {
    crossSeeded: crossSeededCount,
    unique: torrentCount - crossSeededCount,
    total: torrentCount,
  }

  // Activity grid
  const activityGrid = buildActivityMatrix(addedOnTimestamps)

  // Tracker health, storageByTrackerCategory, categoryBreakdown, sizesByTracker, ageTimeline, ageBands
  const trackerHealth: FleetAggregation["trackerHealth"] = []
  const storageByTrackerCategory: FleetAggregation["storageByTrackerCategory"] = []
  const categoryBreakdown: FleetAggregation["categoryBreakdown"] = []
  const sizesByTracker: FleetAggregation["sizesByTracker"] = []
  const ageTimeline: FleetAggregation["ageTimeline"] = []
  const ageBands: FleetAggregation["ageBands"] = []

  for (const [, acc] of trackerAccMap) {
    if (acc.torrentCount === 0) continue

    trackerHealth.push({
      name: acc.name,
      color: acc.color,
      torrentCount: acc.torrentCount,
      avgRatio: acc.validRatioCount > 0 ? acc.ratioSum / acc.validRatioCount : 0,
      uploadSpeedSum: acc.uploadSpeedSum,
      freshnessPct: (acc.freshnessCount / acc.torrentCount) * 100,
      avgSeedTimeDays: acc.seedTimeDaysSum / acc.torrentCount,
    })

    storageByTrackerCategory.push({
      tracker: acc.name,
      categories: Array.from(acc.categoryStorage.entries()).map(([name, { count, totalSize }]) => ({
        name,
        count,
        totalSize,
      })),
    })

    categoryBreakdown.push({
      tracker: acc.name,
      categories: Array.from(acc.categoryStorage.entries()).map(([name, { count }]) => ({
        name,
        count,
      })),
    })

    sizesByTracker.push({
      tag: acc.tag,
      name: acc.name,
      color: acc.color,
      sizes: acc.sizes,
    })

    // Age timeline: sort months ascending
    const sortedMonths = Array.from(acc.monthCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    ageTimeline.push({
      name: acc.name,
      color: acc.color,
      months: sortedMonths,
    })

    ageBands.push({
      name: acc.name,
      color: acc.color,
      counts: acc.ageCounts,
      total: acc.torrentCount,
      avgDays: acc.torrentCount > 0 ? acc.ageTotalDays / acc.torrentCount : 0,
    })
  }

  // Category timeline: sort months ascending per category
  const categoryTimeline: FleetAggregation["categoryTimeline"] = Array.from(
    categoryMonthMap.entries()
  ).map(([category, monthMap]) => ({
    category,
    months: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  }))

  // Cross-seed network
  const trackerTorrentCount = new Map<string, number>()
  const crossSeededPerTracker = new Map<string, number>()
  const pairCounts = new Map<string, number>()

  for (const [, acc] of trackerAccMap) {
    if (acc.torrentCount > 0) {
      trackerTorrentCount.set(acc.tag.toLowerCase(), acc.torrentCount)
    }
  }

  for (const [, trackerSet] of nameToTrackers) {
    if (trackerSet.size < 2) continue
    const arr = Array.from(trackerSet).sort()
    for (const t of arr) {
      crossSeededPerTracker.set(t, (crossSeededPerTracker.get(t) ?? 0) + 1)
    }
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}\0${arr[j]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const networkNodes: CrossSeedNode[] = []
  for (const [tagKey, tt] of trackerTagMap) {
    const count = trackerTorrentCount.get(tagKey) ?? 0
    if (count === 0) continue
    networkNodes.push({
      id: tagKey,
      name: tt.name,
      color: tt.color,
      torrentCount: count,
      crossSeeded: crossSeededPerTracker.get(tagKey) ?? 0,
    })
  }

  const networkEdges: CrossSeedEdge[] = []
  for (const [key, weight] of pairCounts) {
    const [source, target] = key.split("\0")
    networkEdges.push({ source, target, weight })
  }

  return {
    stats,
    ratioDistribution,
    seedTimeDistribution,
    crossSeed,
    activityGrid,
    trackerHealth,
    storageByTrackerCategory,
    categoryBreakdown,
    crossSeedNetwork: { nodes: networkNodes, edges: networkEdges },
    sizesByTracker,
    ageTimeline,
    categoryTimeline,
    ageBands,
  }
}
