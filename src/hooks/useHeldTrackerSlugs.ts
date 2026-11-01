// src/hooks/useHeldTrackerSlugs.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

const NONE_HELD: ReadonlyMap<string, boolean> = new Map()

/**
 * Each slug a tracker row uses, archived rows included, mapped to whether that
 * row is active. When two rows share a slug, the active one decides.
 */
function selectHeldSlugs(trackers: TrackerSummary[]): ReadonlyMap<string, boolean> {
  const held = new Map<string, boolean>()
  for (const { registrySlug, isActive } of trackers) {
    if (registrySlug) held.set(registrySlug, held.get(registrySlug) === true || isActive)
  }
  return held
}

/** The trackers Add Tracker shows as already added, from the shared tracker list. */
function useHeldTrackerSlugs(): ReadonlyMap<string, boolean> {
  const { data } = useQuery({ ...trackerQueryOptions, select: selectHeldSlugs })
  return data ?? NONE_HELD
}

export { useHeldTrackerSlugs }
