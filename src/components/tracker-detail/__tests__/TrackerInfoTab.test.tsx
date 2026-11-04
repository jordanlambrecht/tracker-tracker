// src/components/tracker-detail/__tests__/TrackerInfoTab.test.tsx
//
// Key Rules print the registry's numbers with their units, and a rule of one
// reads in the singular. BroadcasTheNet's 24-hour seed time read "1 days".

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TrackerInfoTab } from "@/components/tracker-detail/TrackerInfoTab"
import { getTrackerBySlug, type TrackerRegistryEntry } from "@/data/tracker-registry"

function renderRules(entry: TrackerRegistryEntry | undefined) {
  render(<TrackerInfoTab registryEntry={entry} stats={null} accentColor="#00d4ff" />)
}

describe("TrackerInfoTab Key Rules", () => {
  it("reads BroadcasTheNet's 24-hour seed time as one day", () => {
    renderRules(getTrackerBySlug("broadcasthenet"))

    expect(screen.getByText("1 day")).toBeInTheDocument()
    expect(screen.getByText("60 days")).toBeInTheDocument()
  })

  it("writes a rule of one in the singular and the rest in the plural", () => {
    const btn = getTrackerBySlug("broadcasthenet")
    if (!btn?.rules) throw new Error("registry entry missing")
    renderRules({
      ...btn,
      rules: {
        ...btn.rules,
        seedTimeHours: 1,
        fulfillmentPeriodHours: 30,
        loginIntervalDays: 1,
        hnrBanLimit: 1,
      },
    })

    expect(screen.getByText("1 hour")).toBeInTheDocument()
    expect(screen.getByText("30 hours")).toBeInTheDocument()
    expect(screen.getByText("1 day")).toBeInTheDocument()
    expect(screen.getByText("1 warning")).toBeInTheDocument()
  })
})
