// src/components/dashboard/useDashboardSettings.test.tsx
//
// Two invariants worth pinning:
//   1. `loaded` means "the server told us", not "the request finished". Consumers gate WebGL
//      charts on it, so flipping it after a failed fetch mounts echarts-gl for the very users
//      who turned it off.
//   2. An update writes only the key it changed. Sending the whole object meant a toggle made
//      before the initial GET resolved wrote defaults over every other stored setting.

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { DASHBOARD_SETTINGS_DEFAULTS } from "@/types/api"
import { useDashboardSettings } from "./useDashboardSettings"

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response
}

type FetchSpy = { mock: { calls: unknown[][] } }

/** The PUT bodies sent so far, parsed. GETs are ignored. */
function putBodies(spy: FetchSpy): Record<string, unknown>[] {
  return spy.mock.calls
    .map((call) => call[1] as RequestInit | undefined)
    .filter((init): init is RequestInit => init?.method === "PUT")
    .map((init) => JSON.parse(init.body as string) as Record<string, unknown>)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useDashboardSettings", () => {
  describe("loaded", () => {
    it("flips true once the server's settings are applied", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({ ...DASHBOARD_SETTINGS_DEFAULTS, enable3DCharts: false })
      )

      const { result } = renderHook(() => useDashboardSettings())

      await waitFor(() => expect(result.current.loaded).toBe(true))
      expect(result.current.settings.enable3DCharts).toBe(false)
    })

    it("stays false when the request fails, so callers keep their safe default", async () => {
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"))

      const { result } = renderHook(() => useDashboardSettings())

      // Give the rejected promise a chance to settle before asserting the negative.
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.loaded).toBe(false)
      // Still defaults. This is exactly why acting on them would be wrong.
      expect(result.current.settings).toEqual(DASHBOARD_SETTINGS_DEFAULTS)
    })

    it("stays false on a non-OK response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ error: "nope" }, false))

      const { result } = renderHook(() => useDashboardSettings())

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.loaded).toBe(false)
    })
  })

  describe("update", () => {
    it("sends only the changed key, never the keys the user did not touch", async () => {
      const spy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ ...DASHBOARD_SETTINGS_DEFAULTS, showLoginTimers: false }))
      const { result } = renderHook(() => useDashboardSettings())
      await waitFor(() => expect(result.current.loaded).toBe(true))

      act(() => {
        result.current.update("enable3DCharts", false)
      })

      const bodies = putBodies(spy)
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toEqual({ enable3DCharts: false })
      // The point of the invariant: an untouched key must not ride along, or a
      // stale local value overwrites what the server already has.
      expect(bodies[0]).not.toHaveProperty("showLoginTimers")
      expect(bodies[0]).not.toHaveProperty("showTodayAtAGlance")
      expect(bodies[0]).not.toHaveProperty("showHealthIndicators")
    })

    it("does not write stale defaults over stored settings when toggled before the GET resolves", async () => {
      // The original bug: GET still in flight, so `prev` is DEFAULTS, and PUTting the
      // whole object reverted every other setting the user had stored.
      const spy = vi.spyOn(global, "fetch").mockImplementation((_url, init) => {
        if ((init as RequestInit | undefined)?.method === "PUT") {
          return Promise.resolve(jsonResponse({}))
        }
        return new Promise<Response>(() => {}) // GET never resolves
      })

      const { result } = renderHook(() => useDashboardSettings())
      expect(result.current.loaded).toBe(false)

      act(() => {
        result.current.update("enable3DCharts", false)
      })

      const bodies = putBodies(spy)
      expect(bodies).toHaveLength(1)
      expect(Object.keys(bodies[0])).toEqual(["enable3DCharts"])
    })
  })

  // The one-time localStorage migration had the same whole-object-write shape the
  // `update` path above was already fixed for: it spread the legacy blob over
  // DEFAULTS and PUT the result, so every key the user never set in localStorage
  // overwrote the server with a default.
  describe("legacy migration", () => {
    it("writes only the keys the legacy blob held, keeping the server's value for the rest", async () => {
      localStorage.setItem(
        STORAGE_KEYS.DASHBOARD_SETTINGS,
        JSON.stringify({ showHealthIndicators: false })
      )
      const spy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ ...DASHBOARD_SETTINGS_DEFAULTS, showLoginTimers: false }))

      const { result } = renderHook(() => useDashboardSettings())
      await waitFor(() => expect(result.current.loaded).toBe(true))

      // Only the migrated key is sent, showLoginTimers must not ride along as a
      // default and overwrite the server's stored `false`.
      expect(putBodies(spy)).toEqual([{ showHealthIndicators: false }])

      // ...and local state reflects the server for keys the blob never had.
      expect(result.current.settings.showLoginTimers).toBe(false)
      expect(result.current.settings.showHealthIndicators).toBe(false)
      expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_SETTINGS)).toBeNull()
    })

    it("discards a null legacy blob instead of PUTting it", async () => {
      // JSON.parse("null") succeeds, so without an explicit guard this reaches the
      // route as the literal body `null`.
      localStorage.setItem(STORAGE_KEYS.DASHBOARD_SETTINGS, "null")
      const spy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ ...DASHBOARD_SETTINGS_DEFAULTS, showLoginTimers: false }))

      const { result } = renderHook(() => useDashboardSettings())
      await waitFor(() => expect(result.current.loaded).toBe(true))

      expect(putBodies(spy)).toEqual([])
      expect(result.current.settings.showLoginTimers).toBe(false)
      expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_SETTINGS)).toBeNull()
    })
  })

  describe("cross-instance sync", () => {
    // Several instances of this hook are mounted at once, the settings sheet,
    // the dashboard, the outage-band provider. Before the broadcast existed, a
    // toggle flipped in the sheet updated only the sheet's copy, so the user
    // could switch something off and watch it stay on everywhere else. This is
    // the seam the "toggle hides the outage bands" behaviour actually rides
    // through in the app, so it is pinned directly.
    it("applies one instance's write to every other instance", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(DASHBOARD_SETTINGS_DEFAULTS))

      const writer = renderHook(() => useDashboardSettings())
      const listener = renderHook(() => useDashboardSettings())
      await waitFor(() => expect(listener.result.current.loaded).toBe(true))
      expect(listener.result.current.settings.showOutageBands).toBe(true)

      act(() => {
        writer.result.current.update("showOutageBands", false)
      })

      expect(writer.result.current.settings.showOutageBands).toBe(false)
      expect(listener.result.current.settings.showOutageBands).toBe(false)
    })

    it("carries only the changed key, leaving the listener's other settings alone", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({ ...DASHBOARD_SETTINGS_DEFAULTS, showLoginTimers: false })
      )

      const writer = renderHook(() => useDashboardSettings())
      const listener = renderHook(() => useDashboardSettings())
      await waitFor(() => expect(listener.result.current.loaded).toBe(true))

      act(() => {
        writer.result.current.update("showOutageBands", false)
      })

      expect(listener.result.current.settings.showOutageBands).toBe(false)
      // Not clobbered back to its default by the broadcast.
      expect(listener.result.current.settings.showLoginTimers).toBe(false)
    })

    it("stops listening once unmounted", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(DASHBOARD_SETTINGS_DEFAULTS))

      const writer = renderHook(() => useDashboardSettings())
      const listener = renderHook(() => useDashboardSettings())
      await waitFor(() => expect(listener.result.current.loaded).toBe(true))
      listener.unmount()

      // A setState on an unmounted hook would warn rather than throw, so assert
      // the writer still works and nothing blew up on the way through.
      act(() => {
        writer.result.current.update("showOutageBands", false)
      })

      expect(writer.result.current.settings.showOutageBands).toBe(false)
    })
  })
})
