// src/components/dashboard/useDashboardSettings.ts
//
// Functions: useDashboardSettings

"use client"

import { useCallback, useEffect, useState } from "react"
import { DASHBOARD_SETTINGS_DEFAULTS, type DashboardSettings } from "@/types/api"

const LEGACY_STORAGE_KEY = "tracker-tracker:dashboard-settings"

const DEFAULTS = DASHBOARD_SETTINGS_DEFAULTS

function useDashboardSettings() {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULTS)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/settings/dashboard")
        if (!res.ok) return
        const data = (await res.json()) as DashboardSettings
        if (cancelled) return

        // One-time migration: if DB has defaults and localStorage has data, migrate
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy) {
          try {
            const parsed = { ...DEFAULTS, ...(JSON.parse(legacy) as Partial<DashboardSettings>) }
            // Save to DB, then clear localStorage
            fetch("/api/settings/dashboard", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            })
            localStorage.removeItem(LEGACY_STORAGE_KEY)
            if (!cancelled) setSettings(parsed)
            return
          } catch {
            localStorage.removeItem(LEGACY_STORAGE_KEY)
          }
        }

        setSettings({ ...DEFAULTS, ...data })
      } catch {
        // Fall back to defaults on network error
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(
    <K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        // Fire-and-forget save
        fetch("/api/settings/dashboard", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
        return next
      })
    },
    []
  )

  return { settings, update }
}

export type { DashboardSettings } from "@/types/api"
export { useDashboardSettings }
