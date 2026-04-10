// src/components/dashboard/useDashboardSettings.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { DASHBOARD_SETTINGS_DEFAULTS, type DashboardSettings } from "@/types/api"

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
        const legacy = localStorage.getItem(STORAGE_KEYS.DASHBOARD_SETTINGS)
        if (legacy) {
          try {
            const parsed = { ...DEFAULTS, ...(JSON.parse(legacy) as Partial<DashboardSettings>) }
            // Save to DB, then clear localStorage
            fetch("/api/settings/dashboard", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            })
            localStorage.removeItem(STORAGE_KEYS.DASHBOARD_SETTINGS)
            if (!cancelled) setSettings(parsed)
            return
          } catch {
            localStorage.removeItem(STORAGE_KEYS.DASHBOARD_SETTINGS)
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
        // Fire-and-forget save inside updater so `next` is guaranteed correct
        // even under rapid sequential calls (prev is always the latest queued state).
        // PUT is idempotent — duplicate calls in StrictMode are harmless.
        fetch("/api/settings/dashboard", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`PUT failed: ${res.status}`)
          })
          .catch(() => {
            // Resync from server to revert the optimistic toggle
            fetch("/api/settings/dashboard")
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data) setSettings({ ...DEFAULTS, ...(data as Partial<DashboardSettings>) })
              })
              .catch(() => {})
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
