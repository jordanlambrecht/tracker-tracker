// src/components/charts/lib/OutageBandsProvider.tsx

"use client"

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import type { Interval } from "@/lib/outages"
import { type ChartDataSource, type ChartOutageBands, NO_OUTAGE_BANDS } from "./outage-bands"

/**
 * How far back a single request asks for
 */
const LOOKBACK_MS = 5 * 365 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000
const REFRESH_MS = 5 * 60 * 1000

const REQUEST_TIMEOUT_MS = 15_000

interface OutageBandsValue {
  /** False when the toggle is off, the fetch failed, or nothing is recorded. */
  enabled: boolean
  /** Ranges where the app itself was not collecting. */
  app: Interval[]
  /** Ranges where every enabled download client was failing at once. */
  allDown: Interval[]
  /**
   * Ranges where the tracker this provider is scoped to failed to answer.
   * Always empty under the unscoped layout provider.
   */
  tracker: Interval[]
}

const EMPTY_VALUE: OutageBandsValue = { enabled: false, app: [], allDown: [], tracker: [] }

const OutageBandsContext = createContext<OutageBandsValue>(EMPTY_VALUE)

interface OutagesResponse {
  app?: Interval[]
  allDown?: Interval[]
  tracker?: Interval[]
}

/** Keep only well-formed, non-empty intervals. The wire is not trusted. */
function sanitize(list: unknown): Interval[] {
  if (!Array.isArray(list)) return []
  const out: Interval[] = []
  for (const raw of list) {
    if (typeof raw !== "object" || raw === null) continue
    const { start, end } = raw as { start?: unknown; end?: unknown }
    if (typeof start !== "number" || typeof end !== "number") continue
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    out.push({ start, end })
  }
  return out
}

interface OutageBandsProviderProps {
  children: ReactNode
  trackerId?: number
}

function OutageBandsProvider({ children, trackerId }: OutageBandsProviderProps) {
  const { settings, loaded } = useDashboardSettings()
  const [bands, setBands] = useState<{
    app: Interval[]
    allDown: Interval[]
    tracker: Interval[]
  }>({
    app: [],
    allDown: [],
    tracker: [],
  })

  // Gate on `loaded: until the server has confirmed the setting
  const active = loaded && settings.showOutageBands

  useEffect(() => {
    if (!active) {
      setBands({ app: [], allDown: [], tracker: [] })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      const to = Date.now()
      const from = to - LOOKBACK_MS
      // Omitted rather than sent empty: the route rejects a malformed trackerId
      // instead of quietly ignoring it, so an absent scope has to be absent.
      const scope = trackerId === undefined ? "" : `&trackerId=${trackerId}`
      try {
        const res = await fetch(`/api/uptime/outages?from=${from}&to=${to}${scope}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        })
        if (!res.ok) return
        const data = (await res.json()) as OutagesResponse
        if (cancelled) return
        setBands({
          app: sanitize(data.app),
          allDown: sanitize(data.allDown),
          tracker: sanitize(data.tracker),
        })
      } catch {
        // Best effort. The ledger tables do not exist until `pnpm db:push` has
        // run, and the route 500s (and logs) until then. Keeping the previous
        // bands rather than clearing them means a transient failure does not
        // make an already-drawn explanation blink out of the chart.
      }
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
    }
  }, [active, trackerId])

  const value = useMemo<OutageBandsValue>(
    () => ({
      enabled: active,
      app: active ? bands.app : [],
      allDown: active ? bands.allDown : [],
      tracker: active ? bands.tracker : [],
    }),
    [active, bands]
  )

  return <OutageBandsContext.Provider value={value}>{children}</OutageBandsContext.Provider>
}

/**
 * Bands this chart is allowed to draw.
 *
 * `"tracker"` gets app bands and tracker bands, never qBT ones. A
 * download-client outage cannot flatten a tracker snapshot (the tracker poller
 * never goes through the client), so a qBT band on a tracker chart would blame
 * the wrong system for the dip.
 *
 * `"qbt"` gets app bands and qBT ones, never tracker ones, for the mirror
 * reason: a tracker being unreachable says nothing about the torrents sitting in
 * a download client. Its qBT layer is the fleet-wide intersection: every enabled
 * client failing at once. One client of two being down still collected half the
 * data, and shading that would hatch over numbers that really exist.
 *
 * Because the two are mutually exclusive, tracker and qBT bands can never
 * co-render, which is why "tracker vs qBT precedence" needs no answer: bands
 * follow the chart's DATA SOURCE and each explains only the source it belongs
 * to. App bands need no tiebreak either — they are subtracted out of both
 * upstream in computeOutageBands, so an app outage always wins by REMOVING the
 * narrower claim rather than by painting over it.
 *
 * The `source === "tracker"` test reads circularly against the `"tracker"` band
 * kind, so, to be explicit: those are DIFFERENT AXES that happen to share a
 * word. The left side is where this chart's numbers come from; the right side is
 * what went down. The line asserts "a tracker-sourced chart may show
 * tracker-outage bands" — a claim, not a tautology.
 */
function useOutageBands(source: ChartDataSource): ChartOutageBands {
  const value = useContext(OutageBandsContext)
  return useMemo(() => {
    if (!value.enabled) return NO_OUTAGE_BANDS
    return {
      app: value.app,
      qbt: source === "qbt" ? value.allDown : [],
      tracker: source === "tracker" ? value.tracker : [],
    }
  }, [value, source])
}

export type { OutageBandsProviderProps, OutageBandsValue }
export { OutageBandsContext, OutageBandsProvider, useOutageBands }
