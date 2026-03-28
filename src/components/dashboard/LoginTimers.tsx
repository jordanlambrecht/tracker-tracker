// src/components/dashboard/LoginTimers.tsx

"use client"

import { useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { ExternalLinkIcon } from "@/components/ui/Icons"
import { SectionToggle } from "@/components/ui/SectionToggle"
import { StatCard } from "@/components/ui/StatCard"
import { findRegistryEntry } from "@/data/tracker-registry"
import type { TrackerSummary } from "@/types/api"

interface TimerEntry {
  tracker: TrackerSummary
  loginIntervalDays: number
  lastAccessAt: string
}

export function LoginTimers({ trackers }: { trackers: TrackerSummary[] }) {
  const [expanded, setExpanded] = useState(true)

  const entries: TimerEntry[] = trackers
    .map((tracker) => {
      if (!tracker.lastAccessAt || !tracker.isActive) return null
      const entry = findRegistryEntry(tracker.baseUrl)
      if (!entry?.rules?.loginIntervalDays) return null

      const lastAccess = new Date(tracker.lastAccessAt).getTime()
      if (Number.isNaN(lastAccess)) return null

      return {
        tracker,
        loginIntervalDays: entry.rules.loginIntervalDays,
        lastAccessAt: tracker.lastAccessAt,
      }
    })
    .filter((e): e is TimerEntry => e !== null)
    .sort((a, b) => {
      const now = Date.now()
      const remA = a.loginIntervalDays * 86400000 - (now - new Date(a.lastAccessAt).getTime())
      const remB = b.loginIntervalDays * 86400000 - (now - new Date(b.lastAccessAt).getTime())
      return remA - remB
    })

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <SectionToggle
        label="Login Timers"
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {entries.map(({ tracker, loginIntervalDays, lastAccessAt }) => (
            <a
              key={tracker.id}
              href={tracker.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block"
            >
              <StatCard
                type="ring"
                title={tracker.name}
                lastAccessAt={lastAccessAt}
                loginIntervalDays={loginIntervalDays}
                accentColor={CHART_THEME.success}
                className="p-3 nm-interactive-sm rounded-nm-md"
              />
              <span className="absolute top-2 right-2 text-muted opacity-0 group-hover:opacity-60 transition-opacity duration-150">
                <ExternalLinkIcon width={12} height={12} />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
