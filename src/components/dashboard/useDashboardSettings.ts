// src/components/dashboard/useDashboardSettings.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { DASHBOARD_SETTINGS_DEFAULTS, type DashboardSettings } from "@/types/api"

const DEFAULTS = DASHBOARD_SETTINGS_DEFAULTS

function useDashboardSettings() {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULTS)
  // Callers that must not act on a default before the real value arrives (e.g. mounting a
  // WebGL chart for someone who turned WebGL off) gate on this instead of reading `settings`
  // straight away. It flips only once server-confirmed settings have been applied — never on
  // a failed fetch, where `settings` is still DEFAULTS and acting on them would do the exact
  // thing the caller is trying to avoid.
  const [loaded, setLoaded] = useState(false)

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
            const raw: unknown = JSON.parse(legacy)
            // JSON.parse("null") succeeds, so a null blob would otherwise reach the
            // PUT as the literal body `null`; parseJsonBody accepts it and the route
            // then dereferences it. Throwing lands in the catch below, which is the
            // established corrupt-blob path (drop it and fall through to the server).
            if (!raw || typeof raw !== "object") throw new Error("corrupt legacy blob")
            const legacyValues = raw as Partial<DashboardSettings>
            // Merge over the server's values, not over DEFAULTS: a key the legacy blob
            // never had must keep what the server holds. Same reason the non-migration
            // path below spreads `data`.
            const parsed = { ...DEFAULTS, ...data, ...legacyValues }
            // Send ONLY the keys the blob actually carried. PUTting the whole object
            // writes a default over every key the user never set in localStorage —
            // the same whole-object-write shape this file's normal save path was
            // already changed away from. The route ignores unknown/mistyped keys.
            fetch("/api/settings/dashboard", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(legacyValues),
            })
            localStorage.removeItem(STORAGE_KEYS.DASHBOARD_SETTINGS)
            if (!cancelled) {
              setSettings(parsed)
              setLoaded(true)
            }
            return
          } catch {
            localStorage.removeItem(STORAGE_KEYS.DASHBOARD_SETTINGS)
          }
        }

        if (!cancelled) {
          setSettings({ ...DEFAULTS, ...data })
          setLoaded(true)
        }
      } catch {
        // Leave `loaded` false: the settings are unknown, not default. Consumers
        // that gate on it keep their safe behaviour instead of acting on a guess.
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
        //
        // Send ONLY the changed key. Sending the whole object meant that toggling
        // before the initial GET resolved wrote DEFAULTS over every other stored
        // setting, silently reverting them. The route merges the keys it receives
        // onto the stored row, so a single-key body cannot touch the rest.
        fetch("/api/settings/dashboard", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
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

  return { settings, loaded, update }
}

export type { DashboardSettings } from "@/types/api"
export { useDashboardSettings }
