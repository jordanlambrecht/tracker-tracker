// src/components/charts/lib/OutageBandsProvider.tsx
//
// One fetch of the outage ledger for the whole page, shared with every chart
// through context.
//
// Mounted once in the authenticated layout. Charts read it with
// `useOutageBands(source)`, which is a plain `useContext`. So a chart rendered
// with no provider above it (unit tests, isolated stories) gets the empty value
// and simply draws no bands, rather than throwing or firing its own request.
//
// ── Scoping lives here, not in the charts ──────────────────────────────────
// `useOutageBands("tracker")` can never return qBT bands. Keeping that rule in
// one place makes "a qBT band never appears on a tracker chart" a property of
// this hook that one test can pin, instead of a convention each of a dozen
// chart files has to remember.
//
// ── UNKNOWN draws nothing ──────────────────────────────────────────────────
// The API returns only positively recorded outages. A range with no record is
// UNKNOWN (nothing observed it) and gets no band and no legend note per the
// owner's decision. This component adds no "everything was fine" affordance,
// because that claim is exactly the one the data cannot support.

"use client"

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import type { Interval } from "@/lib/outages"
import { type ChartDataSource, type ChartOutageBands, NO_OUTAGE_BANDS } from "./outage-bands"

/**
 * How far back a single request asks for. The route rejects windows wider than
 * five years, so this sits just inside that. Gaps are rare rows, so one wide
 * request is cheaper than re-fetching whenever a chart's zoom changes, and it
 * means panning a chart never reveals an unexplained hole.
 */
const LOOKBACK_MS = 5 * 365 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000

/** One bucket width. A newly closed gap cannot appear any sooner than this. */
const REFRESH_MS = 5 * 60 * 1000

const REQUEST_TIMEOUT_MS = 15_000

interface OutageBandsValue {
  /** False when the toggle is off, the fetch failed, or nothing is recorded. */
  enabled: boolean
  /** Ranges where the app itself was not collecting. */
  app: Interval[]
  /** Ranges where every enabled download client was failing at once. */
  allDown: Interval[]
}

const EMPTY_VALUE: OutageBandsValue = { enabled: false, app: [], allDown: [] }

const OutageBandsContext = createContext<OutageBandsValue>(EMPTY_VALUE)

interface OutagesResponse {
  app?: Interval[]
  allDown?: Interval[]
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

function OutageBandsProvider({ children }: { children: ReactNode }) {
  const { settings, loaded } = useDashboardSettings()
  const [bands, setBands] = useState<{ app: Interval[]; allDown: Interval[] }>({
    app: [],
    allDown: [],
  })

  // Gate on `loaded`, not on the default: until the server has confirmed the
  // setting, "on by default" is a guess. Fetching on a guess is harmless, but
  // waiting keeps a user who turned bands off from ever seeing them flash in.
  const active = loaded && settings.showOutageBands

  useEffect(() => {
    if (!active) {
      setBands({ app: [], allDown: [] })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      const to = Date.now()
      const from = to - LOOKBACK_MS
      try {
        const res = await fetch(`/api/uptime/outages?from=${from}&to=${to}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        })
        if (!res.ok) return
        const data = (await res.json()) as OutagesResponse
        if (cancelled) return
        setBands({ app: sanitize(data.app), allDown: sanitize(data.allDown) })
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
  }, [active])

  const value = useMemo<OutageBandsValue>(
    () => ({
      enabled: active,
      app: active ? bands.app : [],
      allDown: active ? bands.allDown : [],
    }),
    [active, bands]
  )

  return <OutageBandsContext.Provider value={value}>{children}</OutageBandsContext.Provider>
}

/**
 * Bands this chart is allowed to draw.
 *
 * `"tracker"` gets app bands only. A download-client outage cannot flatten a
 * tracker snapshot (the tracker poller never goes through the client), so a
 * qBT band on a tracker chart would blame the wrong system for the dip.
 *
 * `"qbt"` gets both. Its qBT layer is the fleet-wide intersection: every
 * enabled client failing at once. One client of two being down still collected
 * half the data, and shading that would hatch over numbers that really exist.
 */
function useOutageBands(source: ChartDataSource): ChartOutageBands {
  const value = useContext(OutageBandsContext)
  return useMemo(() => {
    if (!value.enabled) return NO_OUTAGE_BANDS
    return {
      app: value.app,
      qbt: source === "qbt" ? value.allDown : [],
    }
  }, [value, source])
}

export type { OutageBandsValue }
export { OutageBandsContext, OutageBandsProvider, useOutageBands }
