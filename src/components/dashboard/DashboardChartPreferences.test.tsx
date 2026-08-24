// src/components/dashboard/DashboardChartPreferences.test.tsx
//
// Functions: NoopIntersectionObserver, Dashboard, storedPrefs, sheetToggle, gridCardControl
//
// The analytics grid and the settings sheet are mounted at the same time and both drive chart
// preferences. When each owned its own useChartPreferences instance, every write serialised
// that instance's whole object from its own stale state, so a hide made in the sheet was
// silently reverted by the next collapse made in the grid, and vice versa.
//
// These tests wire both components to ONE instance the way DashboardClient does, drive each
// surface through its own DOM, and assert on what actually landed in localStorage. Revert the
// shared instance and the components fall back to their own state, which is what these
// assertions catch.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AnalyticsSection } from "@/components/dashboard/AnalyticsSection"
import { DashboardSettingsSheet } from "@/components/dashboard/DashboardSettingsSheet"
import type { ChartPrefs } from "@/components/dashboard/useChartPreferences"
import { useChartPreferences } from "@/components/dashboard/useChartPreferences"
import type { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { DASHBOARD_SETTINGS_DEFAULTS } from "@/types/api"

// ChartCard defers mounting its chart until an IntersectionObserver fires. jsdom has no
// implementation, and a no-op one keeps every echarts instance out of these tests while
// leaving the card's own collapse/hide controls (the thing under test) fully rendered.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// A settled settings object, so nothing here reaches for /api/settings/dashboard.
const dashSettings: ReturnType<typeof useDashboardSettings> = {
  settings: DASHBOARD_SETTINGS_DEFAULTS,
  loaded: true,
  update: () => {},
}

let sharedPrefs: ReturnType<typeof useChartPreferences>

function Dashboard() {
  const chartPrefs = useChartPreferences()
  sharedPrefs = chartPrefs
  return (
    <>
      <AnalyticsSection
        trackerSeries={[]}
        trackers={[]}
        chartPrefs={chartPrefs}
        dashSettings={dashSettings}
      />
      <DashboardSettingsSheet
        open
        onClose={() => {}}
        chartPrefs={chartPrefs}
        dashSettings={dashSettings}
      />
    </>
  )
}

function storedPrefs(): Partial<ChartPrefs> {
  const raw = localStorage.getItem(STORAGE_KEYS.CHART_PREFERENCES)
  return raw ? (JSON.parse(raw) as Partial<ChartPrefs>) : {}
}

// The sheet's visibility toggles and the grid's cards both label themselves with the chart's
// title, so each surface is reachable by name without leaning on DOM order.
function sheetToggle(label: string): HTMLElement {
  return screen.getByRole("switch", { name: label })
}

function gridCardControl(label: string, control: string): HTMLElement {
  const card = screen.getByRole("heading", { name: label }).closest("div.relative")
  if (!card) throw new Error(`no chart card rendered for "${label}"`)
  return within(card as HTMLElement).getByRole("button", { name: control })
}

describe("dashboard chart preferences shared across the grid and the settings sheet", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver)
  })

  it("keeps a hide made in the settings sheet when a chart is then collapsed in the grid", async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    await user.click(sheetToggle("Distribution"))
    expect(storedPrefs().hidden).toEqual(["distribution"])

    await user.click(gridCardControl("Daily Volume", "Collapse chart"))

    expect(storedPrefs().hidden).toEqual(["distribution"])
    expect(storedPrefs().collapsed).toEqual(["daily-volume"])
  })

  it("keeps a collapse made in the grid when a chart is then hidden in the settings sheet", async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    await user.click(gridCardControl("Daily Volume", "Collapse chart"))
    expect(storedPrefs().collapsed).toEqual(["daily-volume"])

    await user.click(sheetToggle("Distribution"))

    expect(storedPrefs().collapsed).toEqual(["daily-volume"])
    expect(storedPrefs().hidden).toEqual(["distribution"])
  })

  it("keeps a reorder made in the settings sheet when a chart is then collapsed in the grid", async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    // The sheet's drag handler ends in exactly this call. Driving dnd-kit itself needs real
    // layout, which jsdom does not provide, so the reorder is issued straight to the shared
    // instance, the grid's collapse below still goes through the DOM, which is the half that
    // has to observe it.
    const newOrder = ["distribution", "daily-volume"]
    act(() => {
      sharedPrefs.reorder(newOrder)
    })
    expect(storedPrefs().order).toEqual(newOrder)

    await user.click(gridCardControl("Daily Volume", "Collapse chart"))

    expect(storedPrefs().order).toEqual(newOrder)
    expect(storedPrefs().collapsed).toEqual(["daily-volume"])
  })

  it("drops the card from the grid as soon as the sheet hides it", async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    expect(screen.getByRole("heading", { name: "Distribution" })).toBeInTheDocument()

    await user.click(sheetToggle("Distribution"))

    expect(screen.queryByRole("heading", { name: "Distribution" })).not.toBeInTheDocument()
  })
})
